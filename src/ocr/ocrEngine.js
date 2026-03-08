/**
 * OCRエンジン（シンプル版・改修前の動作ベース）
 *
 * runOCR内でworkerを直接生成する元の方式に戻す。
 * preload/callbackの複雑な仕組みは削除。
 */
import { createWorker } from 'tesseract.js';

const LANGS = 'jpn+eng+kor+chi_sim';

export const runOCR = async (imageBlob, onProgress) => {
  onProgress?.(5);

  const worker = await createWorker(LANGS, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(20 + Math.round(m.progress * 75)); // 20〜95%
      }
    },
  });

  onProgress?.(20);

  const url = URL.createObjectURL(imageBlob);
  try {
    const { data } = await worker.recognize(url);
    onProgress?.(100);
    return {
      text:      data.text,
      lines:     data.lines,
      words:     data.words,
      mangaText: '',
    };
  } finally {
    URL.revokeObjectURL(url);
    await worker.terminate();
  }
};
