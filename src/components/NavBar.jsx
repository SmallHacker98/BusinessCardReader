import React from 'react';
import './NavBar.css';

export const NavBar = ({ title, left, right, large }) => {
  return (
    <div className={`navbar ${large ? 'navbar-large' : ''}`}>
      <div className="navbar-inner">
        <div className="navbar-left">{left}</div>
        <div className="navbar-title">{title}</div>
        <div className="navbar-right">{right}</div>
      </div>
      {large && <div className="navbar-large-title">{title}</div>}
    </div>
  );
};
