import React, { useEffect, useRef, useState } from 'react';
import { DEMO_MODE } from '../api/demoFetch.js';

const DISMISS_KEY = 'demo-banner-dismissed';

export default function DemoModeBanner() {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === 'true'
  );
  const ref = useRef(null);
  const visible = DEMO_MODE && !dismissed;

  // .sidebar and .mobile-nav-close are position:fixed, so they never see this
  // banner's real height via document flow (see Layout.css's SCRUM-63 stacking
  // comment). Publish it as a CSS var instead, so both can offset by however
  // tall the banner actually is right now -- 1 line, 2 lines (mobile wrap), or
  // 0 (not shown / dismissed).
  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !ref.current) {
      root.style.setProperty('--demo-banner-height', '0px');
      return;
    }
    const el = ref.current;
    const setHeight = () => root.style.setProperty('--demo-banner-height', `${el.offsetHeight}px`);
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty('--demo-banner-height', '0px');
    };
  }, [visible]);

  const handleExit = () => {
    setLoading(true);
    fetch('/api/demo/disable', { method: 'POST' })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <div ref={ref} style={{
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <button
          onClick={handleDismiss}
          aria-label="Dismiss demo mode banner"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1a1a1a',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
