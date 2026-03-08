import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ContactCard } from '../components/ContactCard';
import { useContacts } from '../hooks/useContacts';
import './ContactList.css';

export const ContactList = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { contacts, loading } = useContacts(query);

  const grouped = contacts.reduce((acc, c) => {
    const key = c.companyName || 'その他';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  return (
    <div className="page">
      <NavBar
        title="名刺帳"
        large
        right={
          <button className="btn btn-ghost" onClick={() => navigate('/scan')}>
            ＋ 追加
          </button>
        }
      />

      <div className="search-bar-wrap">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="名前・企業名・メールで検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>
      </div>

      <div className="page-content scroll-area">
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state fade-in">
            <div className="icon">🪪</div>
            <p>{query ? '検索結果なし' : '名刺をスキャンして\n登録を始めましょう'}</p>
            {!query && (
              <button className="btn btn-primary" onClick={() => navigate('/scan')}>
                📷 名刺をスキャン
              </button>
            )}
          </div>
        ) : (
          <div className="contact-sections">
            {query ? (
              <div className="card">
                {contacts.map(c => <ContactCard key={c.id} contact={c} />)}
              </div>
            ) : (
              Object.entries(grouped).map(([company, list]) => (
                <div key={company} className="section">
                  <div className="section-title">{company}</div>
                  <div className="card">
                    {list.map(c => <ContactCard key={c.id} contact={c} />)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
