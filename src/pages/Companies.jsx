import React from 'react';
import { NavBar } from '../components/NavBar';

export const Companies = () => (
  <div className="page">
    <NavBar title="企業" large />
    <div className="empty-state" style={{ marginTop: 60 }}>
      <div className="icon">🏢</div>
      <p>企業ネットワーク・ニュース機能は<br />Step 3・4で実装予定</p>
    </div>
  </div>
);
