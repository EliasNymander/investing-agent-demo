import React, { useState, useEffect, useCallback } from 'react';
import { DEMO_MODE } from '../api/demoFetch.js';

export default function DemoModeBanner() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch('/api/demo/status')
      .then((r) => r.json())
      .then((data) => setIsDemoMode(data.isDemoMode))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleExit = () => {
    setLoading(true);
    fetch('/api/demo/disable', { method: 'POST' })
      .then(() => { setIsDemoMode(false); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  if (!isDemoMode) return null;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: 'var(--yellow, #f59e0b)',
      color: '#1a1a1a',
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
      fontWeight: 500,
      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    }}>
      <span>
        <strong>Demo Mode</strong> — showing sample portfolio data. No real holdings are visible.
      </span>
      {!DEMO_MODE && (
        <button
          onClick={handleExit}
          disabled={loading}
          style={{
            background: 'rgba(0,0,0,0.15)',
            border: 'none',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: '#1a1a1a',
          }}
        >
          {loading ? 'Exiting…' : 'Exit Demo Mode'}
        </button>
      )}
    </div>
  );
}
