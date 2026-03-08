import { createWorker } from 'tesseract.js';

// 全言語を常時使用（日本語・英語・韓国語・中国語）
const DEFAULT_LANGS = 'jpn+eng+kor+chi_sim';

let worker = null;

export const initOCR = async (onProgress) => {
  if (worker) return worker;

  worker = await createWorker(DEFAULT_LANGS, 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  return worker;
};

export const runOCR = async (imageBlob, onProgress) => {
  const w = await initOCR(onProgress);
  const url = URL.createObjectURL(imageBlob);
  try {
    const { data } = await w.recognize(url);
    return { text: data.text, lines: data.lines, words: data.words };
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const terminateOCR = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
};
