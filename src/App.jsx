import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ContactList } from './pages/ContactList';
import { ContactDetail } from './pages/ContactDetail';
import { ContactEdit } from './pages/ContactEdit';
import { Scan } from './pages/Scan';
import { Companies } from './pages/Companies';
import { TabBar } from './components/TabBar';
import { initStorage } from './db/database';
import { preloadOCR } from './ocr/ocrEngine';
import './styles/global.css';

export default function App() {
  useEffect(() => {
    initStorage();
    // バックグラウンドでOCR workerを先読み（初回OCRの待ち時間を短縮）
    preloadOCR();
  }, []);

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<ContactList />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/contact/:id" element={<ContactDetail />} />
            <Route path="/edit/:id" element={<ContactEdit />} />
            <Route path="/companies" element={<Companies />} />
          </Routes>
        </div>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
