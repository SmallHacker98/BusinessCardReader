import React, { useState, useEffect } from 'react';
import { preloadOCR, setOCRCallbacks, isOCRReady } from '../ocr/ocrEngine';
import './OCRSetupModal.css';

const STORAGE_KEY = 'ocr_setup_done_v2';

export const OCRSetupModal = ({ onReady }) => {
  const [phase, setPhase] = useState('checking'); // checking|confirm|downloading|done|error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // workerがすでに起動済み（2回目以降 or preloadが完了済み）
    if (isOCRReady()) {
      onReady();
      return;
    }
    // 前回ダウンロード済みフラグがあればモーダルなしで起動
    // ただしpreloadOCR()は必ず呼んでworkerを初期化する
    const done = localStorage.getItem(STORAGE_KEY);
    if (done === 'true') {
      // バックグラウンドで初期化しつつ即onReady
      startDownload(false);
      onReady();
      return;
    }
    // 初回：確認ダイアログを表示
    setPhase('confirm');
  }, []);

  const startDownload = (showProgress) => {
    setOCRCallbacks({
      onProgress: (pct) => {
        if (showProgress) setProgress(pct);
      },
      onDone: () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        if (showProgress) {
          setProgress(100);
          setPhase('done');
          setTimeout(() => onReady(), 600);
        }
      },
      onError: (e) => {
        if (showProgress) {
          setErrorMsg('ダウンロードに失敗しました。通信環境を確認して再度お試しください。');
          setPhase('error');
        }
      },
    });
    preloadOCR();
  };

  const handleYes = () => {
    setPhase('downloading');
    setProgress(0);
    startDownload(true);
  };

  const handleCancel = () => {
    window.close();
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
                  height:100vh;background:#000;color:#fff;
                  font-family:sans-serif;text-align:center;padding:32px;">
        <p>アプリを終了しました。<br/>ホーム画面のアイコンから再度開けます。</p>
      </div>`;
  };

  const handleRetry = () => {
    setPhase('confirm');
    setProgress(0);
    setErrorMsg('');
  };

  // checkingは一瞬なので表示しない
  if (phase === 'checking' || phase === 'done') return null;

  return (
    <div className="ocr-modal-overlay">
      <div className="ocr-modal">

        {phase === 'confirm' && (
          <>
            <div className="ocr-modal-icon">📥</div>
            <h2>OCRデータの準備</h2>
            <p>
              名刺の文字認識に必要なデータ（約40MB）を
              ダウンロードします。<br />
              Wi-Fi環境での実行を推奨します。<br />
              2回目以降はオフラインで動作します。
            </p>
            <div className="ocr-modal-actions">
              <button className="btn btn-secondary" onClick={handleCancel}>
                キャンセル
              </button>
              <button className="btn btn-primary" onClick={handleYes}>
                ダウンロード
              </button>
            </div>
          </>
        )}

        {phase === 'downloading' && (
          <>
            <div className="ocr-modal-icon">⏬</div>
            <h2>ダウンロード中...</h2>
            <p className="ocr-modal-sub">そのままお待ちください</p>
            <div className="ocr-progress-wrap">
              <div className="ocr-progress-bar">
                <div className="ocr-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="ocr-progress-pct">{progress}%</span>
            </div>
            <p className="ocr-modal-hint">アプリを閉じないでください</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="ocr-modal-icon">⚠️</div>
            <h2>ダウンロード失敗</h2>
            <p>{errorMsg}</p>
            <div className="ocr-modal-actions">
              <button className="btn btn-secondary" onClick={handleCancel}>
                終了
              </button>
              <button className="btn btn-primary" onClick={handleRetry}>
                再試行
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
