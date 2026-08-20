import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import './Layout.css';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <>
          <div className="mobile-nav-backdrop" onClick={() => setSidebarOpen(false)} />
          <button
            className="mobile-nav-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </>
      )}
      <main className="app-main">
        <div className="mobile-nav-bar">
          <button
            className="mobile-nav-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
