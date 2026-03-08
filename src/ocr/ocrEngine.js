import { createWorker } from 'tesseract.js';

const LANGS = 'jpn+eng+kor+chi_sim';

export const runOCR = async (imageBlob, onProgress) => {
  console.log('[OCR] runOCR called', { blobSize: imageBlob?.size, blobType: imageBlob?.type });
  onProgress?.(5);

  let worker;
  try {
    console.log('[OCR] creating worker...');
    worker = await createWorker(LANGS, 1, {
      logger: (m) => {
        console.log('[OCR] logger:', m.status, m.progress);
        if (m.status === 'recognizing text') {
          onProgress?.(20 + Math.round(m.progress * 75));
        }
      },
    });
    console.log('[OCR] worker created OK');
  } catch (e) {
    console.error('[OCR] createWorker FAILED:', e);
    throw e;
  }

  onProgress?.(20);

  const url = URL.createObjectURL(imageBlob);
  console.log('[OCR] objectURL created:', url.slice(0, 60));

  try {
    console.log('[OCR] calling recognize...');
    const { data } = await worker.recognize(url);
    console.log('[OCR] recognize done. text length:', data.text?.length);
    console.log('[OCR] text preview:', data.text?.slice(0, 200));
    onProgress?.(100);
    return {
      text:      data.text,
      lines:     data.lines,
      words:     data.words,
      mangaText: '',
    };
  } catch (e) {
    console.error('[OCR] recognize FAILED:', e);
    throw e;
  } finally {
    URL.revokeObjectURL(url);
    await worker.terminate();
    console.log('[OCR] worker terminated');
  }
};
