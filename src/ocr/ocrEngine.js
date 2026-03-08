/**
 * OCRエンジン
 * 
 * 初回起動時に言語データ（約40MB）をダウンロード。
 * ダウンロード進捗をコールバックで外部に通知する。
 */
import { createWorker } from 'tesseract.js';

const LANGS = 'jpn+eng+kor+chi_sim';

let workerPromise = null;
let worker = null;

// 外部から登録するコールバック
let _onDownloadProgress = null; // (pct: 0-100) => void
let _onDownloadDone = null;     // () => void
let _onDownloadError = null;    // (err) => void

export const setOCRCallbacks = ({ onProgress, onDone, onError }) => {
  _onDownloadProgress = onProgress;
  _onDownloadDone     = onDone;
  _onDownloadError    = onError;
};

/**
 * アプリ起動時に呼ぶ（バックグラウンド初期化）
 */
export const preloadOCR = () => {
  if (workerPromise) return workerPromise;

  workerPromise = createWorker(LANGS, 1, {
    logger: (m) => {
      // Tesseractのダウンロード進捗を捕捉
      if (m.status === 'loading tesseract core' ||
          m.status === 'loading language traineddata' ||
          m.status === 'initializing tesseract' ||
          m.status === 'initialized tesseract') {
        const pct = Math.round((m.progress || 0) * 100);
        _onDownloadProgress?.(pct);
      }
    },
  }).then(w => {
    worker = w;
    _onDownloadDone?.();
    console.log('[OCR] Worker ready');
    return w;
  }).catch(e => {
    console.warn('[OCR] Worker init failed:', e);
    _onDownloadError?.(e);
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
  let currentPct = 20;

  const timer = setInterval(() => {
    currentPct = Math.min(currentPct + 4, 88);
    onProgress?.(currentPct);
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

export const isOCRReady = () => !!worker;

export const terminateOCR = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerPromise = null;
  }
};
