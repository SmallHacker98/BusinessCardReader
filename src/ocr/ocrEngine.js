/**
 * OCRエンジン（Tesseract.js）
 * 
 * - App起動時に必ずpreloadOCR()を呼ぶ
 * - ダウンロード進捗はsetOCRCallbacksで外部から受け取る
 * - workerの準備完了/失敗もコールバックで通知
 */
import { createWorker } from 'tesseract.js';

const LANGS = 'jpn+eng+kor+chi_sim';

let workerPromise = null;
let worker = null;

let _onProgress = null;
let _onDone     = null;
let _onError    = null;

export const setOCRCallbacks = ({ onProgress, onDone, onError }) => {
  _onProgress = onProgress;
  _onDone     = onDone;
  _onError    = onError;
};

export const preloadOCR = () => {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    try {
      const w = await createWorker(LANGS, 1, {
        logger: (m) => {
          // Tesseract v4/v5 の進捗イベント
          if (typeof m.progress === 'number') {
            const pct = Math.round(m.progress * 100);
            _onProgress?.(pct);
          }
        },
      });
      worker = w;
      _onDone?.();
      return w;
    } catch (e) {
      console.error('[OCR] init error:', e);
      workerPromise = null;
      worker = null;
      _onError?.(e);
      return null;
    }
  })();

  return workerPromise;
};

export const runOCR = async (imageBlob, onProgress) => {
  // workerがなければここで起動（フォールバック）
  if (!workerPromise) preloadOCR();

  onProgress?.(5);
  const w = await workerPromise;
  if (!w) throw new Error('OCR worker unavailable');

  onProgress?.(20);

  const url = URL.createObjectURL(imageBlob);
  let pct = 20;
  const timer = setInterval(() => {
    pct = Math.min(pct + 4, 88);
    onProgress?.(pct);
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
