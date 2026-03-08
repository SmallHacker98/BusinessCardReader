/**
 * OCRエンジン（manga-ocr優先 + Tesseractフォールバック）
 *
 * シンプル設計：
 * - runOCR()内で毎回ロード（2回目以降はブラウザキャッシュが効く）
 * - preload/callback一切なし
 * - manga-ocr失敗時はTesseractで自動フォールバック
 */
import { createWorker } from 'tesseract.js';

const MODEL_ID = 'Xenova/manga-ocr';

// ── manga-ocr ────────────────────────────────────────────────────────────────

const runMangaOCR = async (imageBlob, onProgress) => {
  console.log('[OCR] trying manga-ocr...');
  onProgress?.(5);

  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  onProgress?.(10);

  const pipe = await pipeline('image-to-text', MODEL_ID, {
    progress_callback: (p) => {
      if (p.status === 'downloading') {
        const pct = p.total ? Math.round((p.loaded / p.total) * 70) + 10 : 15;
        onProgress?.(Math.min(pct, 79));
      }
    },
  });

  onProgress?.(80);
  console.log('[OCR] manga-ocr pipeline ready, recognizing...');

  const url = URL.createObjectURL(imageBlob);
  try {
    const result = await pipe(url);
    onProgress?.(100);
    const text = Array.isArray(result)
      ? result.map(r => r.generated_text).join('\n')
      : (result.generated_text || '');
    console.log('[OCR] manga-ocr result:', text.slice(0, 200));
    return text;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ── Tesseract フォールバック ──────────────────────────────────────────────────

const runTesseract = async (imageBlob, onProgress) => {
  console.log('[OCR] running Tesseract...');
  onProgress?.(5);

  const worker = await createWorker('jpn+eng+kor+chi_sim', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(20 + Math.round(m.progress * 75));
      }
    },
  });

  onProgress?.(20);
  const url = URL.createObjectURL(imageBlob);
  try {
    const { data } = await worker.recognize(url);
    onProgress?.(100);
    console.log('[OCR] Tesseract result:', data.text?.slice(0, 200));
    return { text: data.text, lines: data.lines, words: data.words };
  } finally {
    URL.revokeObjectURL(url);
    await worker.terminate();
  }
};

// ── メイン ────────────────────────────────────────────────────────────────────

export const runOCR = async (imageBlob, onProgress) => {
  console.log('[OCR] runOCR called', { size: imageBlob?.size });

  // manga-ocr を試みる
  try {
    const mangaText = await runMangaOCR(imageBlob, onProgress);
    return {
      text:      mangaText,
      lines:     [],
      words:     [],
      mangaText: mangaText,
      engine:    'manga-ocr',
    };
  } catch (e) {
    console.warn('[OCR] manga-ocr failed, fallback to Tesseract:', e.message);
  }

  // フォールバック: Tesseract
  const result = await runTesseract(imageBlob, onProgress);
  return {
    ...result,
    mangaText: '',
    engine:    'tesseract',
  };
};
