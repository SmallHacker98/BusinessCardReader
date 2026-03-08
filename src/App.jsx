import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ContactList } from './pages/ContactList';
import { ContactDetail } from './pages/ContactDetail';
import { ContactEdit } from './pages/ContactEdit';
import { Scan } from './pages/Scan';
import { Companies } from './pages/Companies';
import { TabBar } from './components/TabBar';
import { OCRSetupModal } from './components/OCRSetupModal';
import { initStorage } from './db/database';
import './styles/global.css';

export default function App() {
  const [ocrReady, setOcrReady] = useState(false);

  useEffect(() => {
    initStorage();
  }, []);

  return (
    <BrowserRouter>
      {/* OCRデータ未ダウンロードの場合はモーダルを表示 */}
      {!ocrReady && (
        <OCRSetupModal onReady={() => setOcrReady(true)} />
      )}

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
