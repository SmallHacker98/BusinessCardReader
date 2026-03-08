import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { runOCR } from '../ocr/ocrEngine';
import { parseFields } from '../ocr/fieldParser';
import { preprocessImage, compressForStorage } from '../storage/photoStorage';
import { useContacts } from '../hooks/useContacts';
import './Scan.css';

const STEPS = { SELECT: 'select', LOADING: 'loading', PREVIEW: 'preview', OCR: 'ocr', EDIT: 'edit' };

const EMPTY_FORM = {
  name: '', companyName: '', department: '',
  title: '', phone: '', fax: '', email: '', address: '',
};

export const Scan = () => {
  const navigate = useNavigate();
  const { saveContact } = useContacts();
  const fileRef    = useRef();
  const galleryRef = useRef();

  const [step, setStep] = useState(STEPS.SELECT);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrBlob, setOcrBlob] = useState(null);
  const [storageBlob, setStorageBlob] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    console.log('[Scan] handleFileSelect', file ? { name: file.name, size: file.size } : 'no file');
    if (!file) return;
    setError(null);
    setStep(STEPS.LOADING);

    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      console.log('[Scan] previewUrl set, starting preprocessing...');

      const [ocr, storage] = await Promise.all([
        preprocessImage(file),
        compressForStorage(file),
      ]);
      console.log('[Scan] preprocessing done', { ocrBlob: ocr?.size, storageBlob: storage?.size });
      setOcrBlob(ocr);
      setStorageBlob(storage);
      setStep(STEPS.PREVIEW);
    } catch (err) {
      console.error('[Scan] handleFileSelect error:', err);
      setError(`画像の読み込みに失敗しました: ${err.message}`);
      setStep(STEPS.SELECT);
    }
  };

  const handleOCR = async () => {
    console.log('[Scan] handleOCR called', { ocrBlob: ocrBlob?.size });
    if (!ocrBlob) {
      console.error('[Scan] ocrBlob is null!');
      setError('OCR用の画像データがありません。もう一度撮影してください。');
      return;
    }
    setStep(STEPS.OCR);
    setOcrProgress(0);
    setError(null);

    try {
      console.log('[Scan] calling runOCR...');
      const result = await runOCR(ocrBlob, (p) => {
        console.log('[Scan] OCR progress:', p);
        setOcrProgress(p);
      });
      console.log('[Scan] runOCR done:', result?.text?.slice(0, 100));

      const parsed = parseFields(result);
      console.log('[Scan] parsed fields:', parsed);

      setForm({
        name:        parsed.name        || '',
        companyName: parsed.companyName || '',
        department:  parsed.department  || '',
        title:       parsed.title       || '',
        phone:       parsed.phone       || '',
        fax:         parsed.fax         || '',
        email:       parsed.email       || '',
        address:     parsed.address     || '',
      });
      setStep(STEPS.EDIT);
    } catch (err) {
      console.error('[Scan] OCR error:', err);
      setError(`OCRエラー: ${err.message}`);
      setForm(EMPTY_FORM);
      setStep(STEPS.EDIT);
    }
  };

  const handleManual = () => {
    setForm(EMPTY_FORM);
    setStep(STEPS.EDIT);
  };

  const handleSave = async () => {
    if (!form.name && !form.companyName) {
      setError('名前または企業名を入力してください');
      return;
    }
    setSaving(true);
    try {
      const contact = await saveContact(form, storageBlob);
      navigate(`/contact/${contact.id}`, { replace: true });
    } catch (e) {
      console.error('[Scan] save error:', e);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setOcrBlob(null);
    setStorageBlob(null);
    setForm(EMPTY_FORM);
    setStep(STEPS.SELECT);
    setError(null);
    if (fileRef.current)    fileRef.current.value    = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  const updateForm = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="page">
      <NavBar
        title="名刺スキャン"
        left={step !== STEPS.SELECT
          ? <button className="btn btn-ghost" onClick={handleReset}>‹ 戻る</button>
          : null
        }
      />

      <div className="page-content scroll-area">

        {step === STEPS.SELECT && (
          <div className="scan-select fade-in">
            <div className="scan-hero">
              <div className="scan-hero-icon">🪪</div>
              <h2>名刺をスキャン</h2>
              <p>カメラで撮影するか<br />写真を選んでください</p>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <div className="scan-actions">
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={handleFileSelect} style={{ display: 'none' }} id="camera-input" />
              <label htmlFor="camera-input" className="btn btn-primary scan-btn">
                📷 カメラで撮影
              </label>
              <input ref={galleryRef} type="file" accept="image/*"
                onChange={handleFileSelect} style={{ display: 'none' }} id="gallery-input" />
              <label htmlFor="gallery-input" className="btn btn-secondary scan-btn">
                🖼 写真を選択
              </label>
              <button className="btn btn-ghost scan-btn" onClick={handleManual}>
                ✏️ 手動で入力
              </button>
            </div>
          </div>
        )}

        {step === STEPS.LOADING && (
          <div className="scan-ocr fade-in">
            <div className="ocr-status">
              <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
              <h3>画像を準備中...</h3>
            </div>
          </div>
        )}

        {step === STEPS.PREVIEW && (
          <div className="scan-preview fade-in">
            <div className="preview-image-wrap">
              <img src={previewUrl} alt="名刺" className="preview-image" />
            </div>
            <div className="preview-actions">
              <button className="btn btn-primary" onClick={handleOCR}>
                🔍 テキストを読み取る
              </button>
              <button className="btn btn-secondary" onClick={handleManual}>
                ✏️ 手動で入力
              </button>
            </div>
          </div>
        )}

        {step === STEPS.OCR && (
          <div className="scan-ocr fade-in">
            <div className="ocr-status">
              <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
              <h3>読み取り中...</h3>
              <p className="ocr-lang-note">日本語・英語・韓国語・中国語</p>
              <div className="progress-bar" style={{ width: 240 }}>
                <div className="progress-fill" style={{ width: `${ocrProgress}%` }} />
              </div>
              <p className="ocr-progress-text">{ocrProgress}%</p>
            </div>
          </div>
        )}

        {step === STEPS.EDIT && (
          <div className="scan-edit fade-in">
            {previewUrl && (
              <div className="edit-preview">
                <img src={previewUrl} alt="名刺" />
              </div>
            )}
            {error && <div className="error-banner">{error}</div>}
            <div className="edit-form">
              <div className="section">
                <div className="section-title">基本情報</div>
                <div className="card form-card">
                  <FormRow label="氏名"   value={form.name}        onChange={v => updateForm('name', v)}        placeholder="山田 太郎" />
                  <FormRow label="役職"   value={form.title}       onChange={v => updateForm('title', v)}       placeholder="営業部長" />
                  <FormRow label="企業名" value={form.companyName} onChange={v => updateForm('companyName', v)} placeholder="株式会社サンプル" />
                  <FormTextarea label="部署名" value={form.department} onChange={v => updateForm('department', v)} placeholder={"営業本部\n第一営業部\n法人営業課"} last />
                </div>
              </div>
              <div className="section">
                <div className="section-title">連絡先</div>
                <div className="card form-card">
                  <FormRow label="電話"   value={form.phone} onChange={v => updateForm('phone', v)} placeholder="090-0000-0000" type="tel" />
                  <FormRow label="FAX"    value={form.fax}   onChange={v => updateForm('fax', v)}   placeholder="03-0000-0000"  type="tel" />
                  <FormRow label="メール" value={form.email} onChange={v => updateForm('email', v)} placeholder="taro@example.com" type="email" last />
                </div>
              </div>
              <div className="section">
                <div className="section-title">住所</div>
                <div className="card form-card">
                  <FormTextarea label="住所" value={form.address} onChange={v => updateForm('address', v)}
                    placeholder={"〒100-0001\n東京都千代田区千代田1-1"} last />
                </div>
              </div>
              <div className="section" style={{ paddingBottom: 40 }}>
                <button className="btn btn-primary" style={{ width: '100%' }}
                  onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '💾 保存する'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FormRow = ({ label, value, onChange, placeholder, type = 'text', last }) => (
  <div className={`form-row ${last ? 'last' : ''}`}>
    <span className="form-label">{label}</span>
    <input className="form-input" type={type} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const FormTextarea = ({ label, value, onChange, placeholder, last }) => (
  <div className={`form-row form-row-textarea ${last ? 'last' : ''}`}>
    <span className="form-label form-label-top">{label}</span>
    <textarea className="form-textarea" value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={Math.max(2, (value || '').split('\n').length)} />
  </div>
);
