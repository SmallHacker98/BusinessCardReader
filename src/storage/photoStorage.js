import db from '../db/database';

const OPFS_SUPPORTED = typeof navigator !== 'undefined' &&
  'storage' in navigator &&
  'getDirectory' in navigator.storage;

// OPFS: 写真を保存
const saveToOPFS = async (contactId, blob) => {
  const root = await navigator.storage.getDirectory();
  const photosDir = await root.getDirectoryHandle('photos', { create: true });
  const fileHandle = await photosDir.getFileHandle(`${contactId}.jpg`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { ref: `photos/${contactId}.jpg`, storage: 'opfs' };
};

// IndexedDB: 写真を保存（フォールバック）
const saveToIDB = async (contactId, blob) => {
  await db.settings.put({ key: `photo_${contactId}`, value: blob });
  return { ref: `photo_${contactId}`, storage: 'idb' };
};

// OPFS: 写真を読み込み
const loadFromOPFS = async (ref) => {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = ref.split('/');
    const photosDir = await root.getDirectoryHandle(parts[0]);
    const fileHandle = await photosDir.getFileHandle(parts[1]);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
};

// IndexedDB: 写真を読み込み
const loadFromIDB = async (ref) => {
  try {
    const record = await db.settings.get(ref);
    if (record?.value) return URL.createObjectURL(record.value);
    return null;
  } catch {
    return null;
  }
};

// OPFS: 写真を削除
const deleteFromOPFS = async (ref) => {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = ref.split('/');
    const photosDir = await root.getDirectoryHandle(parts[0]);
    await photosDir.removeEntry(parts[1]);
  } catch (e) {
    console.warn('OPFS delete error:', e);
  }
};

// IndexedDB: 写真を削除
const deleteFromIDB = async (ref) => {
  try {
    await db.settings.delete(ref);
  } catch (e) {
    console.warn('IDB delete error:', e);
  }
};

export const photoStorage = {
  save: async (contactId, blob) => {
    if (OPFS_SUPPORTED) {
      try {
        return await saveToOPFS(contactId, blob);
      } catch {
        return await saveToIDB(contactId, blob);
      }
    }
    return await saveToIDB(contactId, blob);
  },

  load: async (ref, storage) => {
    if (!ref) return null;
    if (storage === 'opfs') return await loadFromOPFS(ref);
    return await loadFromIDB(ref);
  },

  delete: async (ref, storage) => {
    if (!ref) return;
    if (storage === 'opfs') await deleteFromOPFS(ref);
    else await deleteFromIDB(ref);
  }
};

// 画像前処理：リサイズ + コントラスト強調
export const preprocessImage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // コントラスト強調
      ctx.filter = 'contrast(1.2) brightness(1.05)';
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    };
    img.src = url;
  });
};
