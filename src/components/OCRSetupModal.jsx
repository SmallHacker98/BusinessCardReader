import React, { useState, useEffect } from 'react';
import './OCRSetupModal.css';

const STORAGE_KEY = 'ocr_setup_acknowledged';

/**
 * 初回起動時のみ「約40MBダウンロードが発生します」を案内するモーダル。
 * 実際のダウンロードはrunOCR()実行時に自動で行われる。
 */
export const OCRSetupModal = ({ onReady }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (done === 'true') {
      onReady();
    } else {
      setVisible(true);
    }
  }, []);

  const handleYes = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onReady();
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

  if (!visible) return null;

  return (
    <div className="ocr-modal-overlay">
      <div className="ocr-modal">
        <div className="ocr-modal-icon">📥</div>
        <h2>OCRデータの準備</h2>
        <p>
          名刺の文字認識に必要なデータ（約40MB）を
          初回スキャン時に自動でダウンロードします。<br /><br />
          Wi-Fi環境での利用を推奨します。<br />
          2回目以降はオフラインで動作します。
        </p>
        <div className="ocr-modal-actions">
          <button className="btn btn-secondary" onClick={handleCancel}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleYes}>
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
};
