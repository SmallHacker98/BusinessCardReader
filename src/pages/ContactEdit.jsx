import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useContacts } from '../hooks/useContacts';
import './Scan.css';

export const ContactEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getContact, saveContact } = useContacts();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getContact(id).then(c => { if (c) setForm(c); });
  }, [id]);

  const updateForm = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name && !form.companyName) {
      setError('名前または企業名を入力してください');
      return;
    }
    setSaving(true);
    try {
      await saveContact(form, null);
      navigate(`/contact/${id}`, { replace: true });
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return (
    <div className="page">
      <NavBar title="編集"
        left={<button className="btn btn-ghost" onClick={() => navigate(-1)}>キャンセル</button>} />
      <div className="empty-state"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="page">
      <NavBar
        title="編集"
        left={<button className="btn btn-ghost" onClick={() => navigate(-1)}>キャンセル</button>}
        right={<button className="btn btn-ghost" onClick={handleSave} disabled={saving}>
          {saving ? '保存中' : '保存'}
        </button>}
      />
      <div className="page-content scroll-area">
        {error && <div className="error-banner" style={{ margin: '12px 16px 0' }}>{error}</div>}

        <div className="edit-form fade-in">
          <div className="section">
            <div className="section-title">基本情報</div>
            <div className="card form-card">
              <FormRow     label="氏名"   value={form.name || ''}        onChange={v => updateForm('name', v)}        placeholder="山田 太郎" />
              <FormRow     label="役職"   value={form.title || ''}       onChange={v => updateForm('title', v)}       placeholder="営業部長" />
              <FormRow     label="企業名" value={form.companyName || ''} onChange={v => updateForm('companyName', v)} placeholder="株式会社サンプル" />
              <FormTextarea label="部署名" value={form.department || ''} onChange={v => updateForm('department', v)}
                placeholder={"営業本部\n第一営業部"} last />
            </div>
          </div>
          <div className="section">
            <div className="section-title">連絡先</div>
            <div className="card form-card">
              <FormRow label="電話"   value={form.phone || ''} onChange={v => updateForm('phone', v)} placeholder="090-0000-0000" type="tel" />
              <FormRow label="FAX"    value={form.fax || ''}   onChange={v => updateForm('fax', v)}   placeholder="03-0000-0000"  type="tel" />
              <FormRow label="メール" value={form.email || ''} onChange={v => updateForm('email', v)} placeholder="taro@example.com" type="email" last />
            </div>
          </div>
          <div className="section" style={{ paddingBottom: 40 }}>
            <div className="section-title">住所</div>
            <div className="card form-card">
              <FormTextarea label="住所" value={form.address || ''} onChange={v => updateForm('address', v)}
                placeholder={"〒100-0001\n東京都千代田区千代田1-1"} last />
            </div>
          </div>
        </div>
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
