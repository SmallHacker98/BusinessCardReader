/**
 * ハイブリッドOCRエンジン
 *
 * 1次: Transformers.js (manga-ocr) → 日本語テキスト全般
 * 2次: Tesseract.js                → 電話/FAX/メール/住所（構造化データ）
 *
 * 初回起動時にmanga-ocrモデル（約400MB）をダウンロードし、
 * Service Workerにキャッシュ。2回目以降は完全オフライン動作。
 */

import { createWorker } from 'tesseract.js';

// ── Transformers.js (manga-ocr) ──────────────────────────────────────────────

let transformersPipeline = null;
let transformersLoading = false;
let transformersError = null;

const MODEL_ID = 'Xenova/manga-ocr';

/**
 * manga-ocrパイプラインを初期化（初回のみダウンロード）
 * @param {function} onProgress (0〜100)
 */
export const initTransformers = async (onProgress) => {
  if (transformersPipeline) return transformersPipeline;
  if (transformersLoading) {
    // 別の呼び出しが初期化中なら待機
    while (transformersLoading) await new Promise(r => setTimeout(r, 200));
    return transformersPipeline;
  }

  transformersLoading = true;
  try {
    const { pipeline, env } = await import('@huggingface/transformers');

    // ブラウザ内でWASMバックエンドを使用
    env.allowLocalModels = false;
    env.backends.onnx.wasm.proxy = false;

    onProgress?.(5);

    transformersPipeline = await pipeline('image-to-text', MODEL_ID, {
      progress_callback: (p) => {
        if (p.status === 'downloading') {
          const pct = p.total ? Math.round((p.loaded / p.total) * 80) + 5 : 10;
          onProgress?.(Math.min(pct, 85));
        }
      },
    });

    onProgress?.(90);
    return transformersPipeline;
  } catch (e) {
    transformersError = e;
    console.warn('Transformers.js init failed, fallback to Tesseract only:', e);
    return null;
  } finally {
    transformersLoading = false;
  }
};

/**
 * manga-ocrで画像からテキストを抽出
 */
const runMangaOCR = async (imageBlob, onProgress) => {
  const pipe = await initTransformers(onProgress);
  if (!pipe) return null;

  const url = URL.createObjectURL(imageBlob);
  try {
    const result = await pipe(url);
    onProgress?.(95);
    // manga-ocrは配列で返す: [{ generated_text: "..." }]
    return Array.isArray(result)
      ? result.map(r => r.generated_text).join('\n')
      : result.generated_text || null;
  } catch (e) {
    console.warn('manga-ocr recognition failed:', e);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ── Tesseract.js ─────────────────────────────────────────────────────────────

let tesseractWorker = null;

const initTesseract = async (onProgress) => {
  if (tesseractWorker) return tesseractWorker;
  tesseractWorker = await createWorker('jpn+eng+kor+chi_sim', 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  return tesseractWorker;
};

const runTesseract = async (imageBlob, onProgress) => {
  const w = await initTesseract(onProgress);
  const url = URL.createObjectURL(imageBlob);
  try {
    const { data } = await w.recognize(url);
    return { text: data.text, lines: data.lines, words: data.words };
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ── メイン: ハイブリッドOCR ─────────────────────────────────────────────────

/**
 * @param {Blob} imageBlob        前処理済み画像
 * @param {function} onProgress   進捗コールバック (0〜100)
 * @param {function} onStageChange ステージ名コールバック ('model'|'ocr'|'done')
 * @returns {{ text, lines, words, mangaText }}
 */
export const runOCR = async (imageBlob, onProgress, onStageChange) => {
  onProgress?.(0);

  // ── Stage1: manga-ocr（日本語テキスト全体）
  onStageChange?.('model');
  const mangaText = await runMangaOCR(imageBlob, (p) => {
    onProgress?.(Math.round(p * 0.5)); // 0〜50%
  });

  // ── Stage2: Tesseract（構造化データ抽出用）
  onStageChange?.('ocr');
  const tesseractResult = await runTesseract(imageBlob, (p) => {
    onProgress?.(50 + Math.round(p * 0.5)); // 50〜100%
  });

  onProgress?.(100);
  onStageChange?.('done');

  // 両方のテキストを結合して返す（fieldParserが使い分け）
  return {
    text: tesseractResult.text,
    lines: tesseractResult.lines,
    words: tesseractResult.words,
    mangaText: mangaText || '',           // manga-ocrの生テキスト
    combined: [mangaText || '', tesseractResult.text].join('\n'), // 統合テキスト
  };
};

export const terminateOCR = async () => {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
  transformersPipeline = null;
};
