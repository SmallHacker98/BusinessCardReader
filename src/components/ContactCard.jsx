import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhoto } from '../hooks/usePhoto';
import './ContactCard.css';

const getInitial = (name) => {
  if (!name) return '?';
  return name.charAt(0);
};

const ACCENT_COLORS = [
  '#0a84ff', '#30d158', '#ff9f0a', '#ff453a',
  '#bf5af2', '#64d2ff', '#ff6961', '#5ac8fa'
];

const getColor = (name) => {
  if (!name) return ACCENT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
};

export const ContactCard = ({ contact }) => {
  const navigate = useNavigate();
  const photoUrl = usePhoto(contact.photoRef, contact.photoStorageType);
  const color = getColor(contact.name);

  return (
    <div className="contact-card" onClick={() => navigate(`/contact/${contact.id}`)}>
      <div className="avatar" style={!photoUrl ? { background: color + '22', color } : {}}>
        {photoUrl
          ? <img src={photoUrl} alt={contact.name} />
          : <span>{getInitial(contact.name)}</span>
        }
      </div>
      <div className="contact-card-body">
        <div className="contact-card-name">{contact.name || '名前なし'}</div>
        <div className="contact-card-sub">
          {contact.companyName && <span>{contact.companyName}</span>}
          {contact.department && <span className="dept">{contact.department}</span>}
        </div>
        {contact.email && (
          <div className="contact-card-email">{contact.email}</div>
        )}
      </div>
      <div className="contact-card-arrow">›</div>
    </div>
  );
};
