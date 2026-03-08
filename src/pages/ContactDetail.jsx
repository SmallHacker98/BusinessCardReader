import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useContacts } from '../hooks/useContacts';
import { usePhoto } from '../hooks/usePhoto';
import db from '../db/database';
import './ContactDetail.css';

export const ContactDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deleteContact, getContact } = useContacts();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const photoUrl = usePhoto(contact?.photoRef, contact?.photoStorageType);

  useEffect(() => {
    const load = async () => {
      const c = await getContact(id);
      setContact(c);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    await deleteContact(contact.id, contact.photoRef, contact.photoStorageType);
    navigate('/', { replace: true });
  };

  const handleCall = (phone) => {
    window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  };

  const handleEmail = (email) => {
    window.location.href = `mailto:${email}`;
  };

  if (loading) {
    return (
      <div className="page">
        <NavBar title="" left={<button className="btn btn-ghost" onClick={() => navigate(-1)}>‹ 戻る</button>} />
        <div className="empty-state"><div className="spinner" /></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="page">
        <NavBar title="" left={<button className="btn btn-ghost" onClick={() => navigate(-1)}>‹ 戻る</button>} />
        <div className="empty-state"><p>名刺が見つかりません</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <NavBar
        title=""
        left={<button className="btn btn-ghost" onClick={() => navigate(-1)}>‹ 戻る</button>}
        right={<button className="btn btn-ghost" onClick={() => navigate(`/edit/${contact.id}`)}>編集</button>}
      />

      <div className="page-content scroll-area">
        {/* ヘッダー */}
        <div className="detail-header fade-in">
          <div className="detail-avatar">
            {photoUrl
              ? <img src={photoUrl} alt={contact.name} />
              : <span>{contact.name?.charAt(0) || '?'}</span>
            }
          </div>
          <h1 className="detail-name">{contact.name || '名前なし'}</h1>
          {contact.companyName && (
            <p className="detail-company">{contact.companyName}</p>
          )}
          {contact.title && (
            <span className="tag" style={{ marginTop: 4, background: 'rgba(48,209,88,0.15)', color: 'var(--accent-green)' }}>{contact.title}</span>
          )}
          {contact.department && (
            <div style={{ marginTop: 6, textAlign: 'center' }}>
              {contact.department.split('\n').map((line, i) => (
                <span key={i} className="tag" style={{ margin: '2px 4px', display: 'inline-block' }}>{line}</span>
              ))}
            </div>
          )}
        </div>

        {/* クイックアクション */}
        {(contact.phone || contact.email) && (
          <div className="detail-actions fade-in">
            {contact.phone && (
              <button className="action-btn" onClick={() => handleCall(contact.phone)}>
                <span className="action-icon">📞</span>
                <span>電話</span>
              </button>
            )}
            {contact.email && (
              <button className="action-btn" onClick={() => handleEmail(contact.email)}>
                <span className="action-icon">✉️</span>
                <span>メール</span>
              </button>
            )}
            {contact.phone && (
              <button className="action-btn" onClick={() => handleCall(contact.fax || contact.phone)}>
                <span className="action-icon">📠</span>
                <span>FAX</span>
              </button>
            )}
          </div>
        )}

        {/* 詳細情報 */}
        <div className="section fade-in">
          <div className="section-title">連絡先情報</div>
          <div className="card">
            {contact.phone && <DetailRow icon="📞" label="電話" value={contact.phone} onTap={() => handleCall(contact.phone)} />}
            {contact.fax && <DetailRow icon="📠" label="FAX" value={contact.fax} />}
            {contact.email && <DetailRow icon="✉️" label="メール" value={contact.email} onTap={() => handleEmail(contact.email)} />}
            {contact.address && <DetailRow icon="📍" label="住所" value={contact.address} />}
            {!contact.phone && !contact.fax && !contact.email && !contact.address && (
              <div className="detail-empty-row">連絡先情報なし</div>
            )}
          </div>
        </div>

        {contact.companyName && (
          <div className="section fade-in">
            <div className="section-title">企業</div>
            <div className="card">
              <DetailRow
                icon="🏢"
                label="企業名"
                value={contact.companyName}
                onTap={() => navigate(`/companies?q=${encodeURIComponent(contact.companyName)}`)}
                accent
              />
            </div>
          </div>
        )}

        {/* 名刺写真 */}
        {photoUrl && (
          <div className="section fade-in">
            <div className="section-title">名刺写真</div>
            <div className="card">
              <img src={photoUrl} alt="名刺" className="detail-card-image" />
            </div>
          </div>
        )}

        {/* メタ情報 */}
        <div className="section fade-in">
          <div className="section-title">登録情報</div>
          <div className="card">
            <DetailRow icon="📅" label="登録日" value={new Date(contact.createdAt).toLocaleDateString('ja-JP')} />
            {contact.updatedAt && contact.updatedAt !== contact.createdAt && (
              <DetailRow icon="🔄" label="更新日" value={new Date(contact.updatedAt).toLocaleDateString('ja-JP')} last />
            )}
          </div>
        </div>

        {/* 削除 */}
        <div className="section" style={{ paddingBottom: 32 }}>
          {!showDelete ? (
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setShowDelete(true)}>
              🗑 この名刺を削除
            </button>
          ) : (
            <div className="delete-confirm">
              <p>本当に削除しますか？</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDelete(false)}>キャンセル</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete}>削除する</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ icon, label, value, onTap, accent, last }) => (
  <div className={`detail-row ${onTap ? 'tappable' : ''} ${last ? 'last' : ''}`} onClick={onTap}>
    <span className="detail-row-icon">{icon}</span>
    <div className="detail-row-body">
      <span className="detail-row-label">{label}</span>
      <span className={`detail-row-value ${accent ? 'accent' : ''}`}>{value}</span>
    </div>
    {onTap && <span className="detail-row-arrow">›</span>}
  </div>
);
