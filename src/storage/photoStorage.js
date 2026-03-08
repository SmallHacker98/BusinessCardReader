import db from '../db/database';

const OPFS_SUPPORTED = typeof navigator !== 'undefined' &&
  'storage' in navigator &&
  'getDirectory' in navigator.storage;

const saveToOPFS = async (contactId, blob) => {
  const root = await navigator.storage.getDirectory();
  const photosDir = await root.getDirectoryHandle('photos', { create: true });
  const fileHandle = await photosDir.getFileHandle(`${contactId}.jpg`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { ref: `photos/${contactId}.jpg`, storage: 'opfs' };
};

const saveToIDB = async (contactId, blob) => {
  await db.settings.put({ key: `photo_${contactId}`, value: blob });
  return { ref: `photo_${contactId}`, storage: 'idb' };
};

const loadFromOPFS = async (ref) => {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = ref.split('/');
    const photosDir = await root.getDirectoryHandle(parts[0]);
    const fileHandle = await photosDir.getFileHandle(parts[1]);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch { return null; }
};

const loadFromIDB = async (ref) => {
  try {
    const record = await db.settings.get(ref);
    if (record?.value) return URL.createObjectURL(record.value);
    return null;
  } catch { return null; }
};

const deleteFromOPFS = async (ref) => {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = ref.split('/');
    const photosDir = await root.getDirectoryHandle(parts[0]);
    await photosDir.removeEntry(parts[1]);
  } catch (e) { console.warn('OPFS delete error:', e); }
};

const deleteFromIDB = async (ref) => {
  try { await db.settings.delete(ref); }
  catch (e) { console.warn('IDB delete error:', e); }
};

export const photoStorage = {
  save: async (contactId, blob) => {
    if (OPFS_SUPPORTED) {
      try { return await saveToOPFS(contactId, blob); }
      catch { return await saveToIDB(contactId, blob); }
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

export const preprocessImage = (file) => {
  console.log('[preprocess] start', { name: file.name, size: file.size, type: file.type });
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onerror = (e) => {
      console.error('[preprocess] img.onerror', e);
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.onload = () => {
      URL.revokeObjectURL(url);
      console.log('[preprocess] img loaded', { w: img.width, h: img.height });
      try {
        const MAX = 1600;
        let { width, height } = img;
        const ratio = Math.max(MAX / width, MAX / height);
        if (ratio > 1) {
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        console.log('[preprocess] canvas size', { width, height });

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.1)';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        console.log('[preprocess] drawImage done');

        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('[preprocess] toBlob success', { size: blob.size });
              resolve(blob);
            } else {
              console.error('[preprocess] toBlob returned null');
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/png'
        );
      } catch (e) {
        console.error('[preprocess] exception:', e);
        reject(e);
      }
    };

    img.src = url;
  });
};

export const compressForStorage = (file) => {
  console.log('[compress] start', { size: file.size });
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onerror = (e) => {
      console.error('[compress] img.onerror', e);
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const r = Math.min(MAX / width, MAX / height);
          width  = Math.round(width  * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('[compress] toBlob success', { size: blob.size });
              resolve(blob);
            } else {
              console.error('[compress] toBlob returned null');
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          0.85
        );
      } catch (e) {
        console.error('[compress] exception:', e);
        reject(e);
      }
    };

    img.src = url;
  });
};
