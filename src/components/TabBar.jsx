import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './TabBar.css';

const TABS = [
  { path: '/', label: '名刺帳', icon: '🪪' },
  { path: '/scan', label: 'スキャン', icon: '📷' },
  { path: '/companies', label: '企業', icon: '🏢' },
];

export const TabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="tabbar">
      {TABS.map(tab => {
        const active = location.pathname === tab.path ||
          (tab.path !== '/' && location.pathname.startsWith(tab.path));
        return (
          <button
            key={tab.path}
            className={`tabbar-item ${active ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="tabbar-icon">{tab.icon}</span>
            <span className="tabbar-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
