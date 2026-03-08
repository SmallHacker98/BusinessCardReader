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

// ─────────────────────────────────────────
// 画像前処理：OCR精度最大化版
// カメラ撮影（照明ムラ・影・ピンボケ）に対応
// ─────────────────────────────────────────
export const preprocessImage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // ── Step1: 2400px にアップスケール（小文字の認識率が大幅向上）
      const TARGET = 2400;
      let { width, height } = img;
      const ratio = Math.max(TARGET / width, TARGET / height);
      if (ratio > 1) {
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // ── Step2: 描画（高品質スケーリング）
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // ── Step3: ピクセル操作でグレースケール + 適応的二値化
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // グレースケール変換
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        // 人間の視覚特性に合わせた重み（BT.601）
        gray[i / 4] = Math.round(
          data[i]     * 0.299 +  // R
          data[i + 1] * 0.587 +  // G
          data[i + 2] * 0.114    // B
        );
      }

      // 適応的二値化：局所領域の平均輝度を基準に閾値を動的に決定
      // → 照明ムラ・影があっても文字を正しく二値化できる
      const BLOCK = Math.round(width / 20); // ブロックサイズ（画像幅の1/20）
      const C = 8; // 平均より C だけ暗ければ黒と判定

      const binarized = new Uint8ClampedArray(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // 周辺ブロックの平均輝度を計算
          let sum = 0, count = 0;
          const x0 = Math.max(0, x - BLOCK);
          const x1 = Math.min(width  - 1, x + BLOCK);
          const y0 = Math.max(0, y - BLOCK);
          const y1 = Math.min(height - 1, y + BLOCK);
          for (let by = y0; by <= y1; by += 2) {
            for (let bx = x0; bx <= x1; bx += 2) {
              sum += gray[by * width + bx];
              count++;
            }
          }
          const mean = sum / count;
          binarized[y * width + x] = gray[y * width + x] < mean - C ? 0 : 255;
        }
      }

      // ── Step4: シャープ化（文字の輪郭を強調）
      const sharpened = new Uint8ClampedArray(width * height);
      const kernel = [
        0, -1,  0,
       -1,  5, -1,
        0, -1,  0
      ];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let val = 0;
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              val += binarized[(y + ky) * width + (x + kx)] * kernel[ki++];
            }
          }
          sharpened[y * width + x] = Math.max(0, Math.min(255, val));
        }
      }

      // ── Step5: RGBAに戻す（白黒）
      for (let i = 0; i < data.length; i += 4) {
        const v = sharpened[i / 4] ?? binarized[i / 4];
        data[i]     = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);

      // ── Step6: PNG で出力（可逆圧縮 → 文字品質を保持）
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };

    img.src = url;
  });
};

// OCRとは別に、保存用に元画像を圧縮（プレビュー表示用）
export const compressForStorage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width  = Math.round(width  * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    };
    img.src = url;
  });
};
