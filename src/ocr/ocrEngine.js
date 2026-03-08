/**
 * OCRエンジン（Tesseract.js安定版）
 *
 * アプリ起動時にバックグラウンドでworkerを初期化することで
 * 初回OCRのロード待ちを大幅に短縮する。
 */
import { createWorker } from 'tesseract.js';

const LANGS = 'jpn+eng+kor+chi_sim';

let workerPromise = null;
let worker = null;
let currentProgress = 0;

/**
 * アプリ起動時に呼ぶ（バックグラウンド初期化）
 * App.jsx の useEffect から呼び出す
 */
export const preloadOCR = () => {
  if (workerPromise) return workerPromise;
  workerPromise = createWorker(LANGS, 1, {}).then(w => {
    worker = w;
    console.log('[OCR] Worker ready');
    return w;
  }).catch(e => {
    console.warn('[OCR] Worker init failed:', e);
    workerPromise = null;
    worker = null;
    return null;
  });
  return workerPromise;
};

/**
 * OCR実行
 */
export const runOCR = async (imageBlob, onProgress) => {
  if (!workerPromise) preloadOCR();

  onProgress?.(5);
  const w = await workerPromise;
  if (!w) throw new Error('OCR worker unavailable');

  onProgress?.(20);

  const url = URL.createObjectURL(imageBlob);
  currentProgress = 20;

  // 擬似進捗（Tesseractの内部進捗はworker生成時にしか取れないため）
  const timer = setInterval(() => {
    currentProgress = Math.min(currentProgress + 4, 88);
    onProgress?.(currentProgress);
  }, 600);

  try {
    const { data } = await w.recognize(url);
    clearInterval(timer);
    onProgress?.(100);

    return {
      text:      data.text,
      lines:     data.lines,
      words:     data.words,
      mangaText: '',
    };
  } catch (e) {
    clearInterval(timer);
    throw e;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const terminateOCR = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerPromise = null;
  }
};
