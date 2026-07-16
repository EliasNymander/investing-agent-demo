import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useSWRConfig } from 'swr';
import { useAccounts, useActiveAccount } from '../../hooks/useAccounts.js';
import { switchAccountApi } from '../../api/accounts.js';
import './Header.css';

export default function Header({ title, subtitle }) {
  const { theme, toggle } = useTheme();
  const { mutate: globalMutate } = useSWRConfig();
  const { accounts } = useAccounts();
  const { activeAccount } = useActiveAccount();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    globalMutate(() => true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleSwitch = async (id) => {
    if (id === activeAccount?.id || switching) return;
    setSwitching(true);
    try { await switchAccountApi(id); globalMutate(() => true); }
    catch { /* non-critical */ }
    finally { setSwitching(false); setDropdownOpen(false); }
  };

  const now = new Date().toLocaleString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const showSwitcher = accounts.length > 1;

  return (
    <header className="page-header">
      <div className="page-header-left">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <div className="page-header-right">
        <span className="page-timestamp">{now}</span>
        {activeAccount && (
          <div className="acct-badge-wrapper" ref={dropdownRef}>
            <button
              className={`acct-badge${switching ? ' acct-switching' : ''}`}
              onClick={() => showSwitcher && setDropdownOpen((o) => !o)}
              title={showSwitcher ? 'Switch account' : activeAccount.name}
              style={{ cursor: showSwitcher ? 'pointer' : 'default' }}
              disabled={switching}
            >
              <span className="acct-dot" style={{ background: activeAccount.color ?? '#4CAF50' }} />
              <span className="acct-badge-name">{activeAccount.name}</span>
              {showSwitcher && <span className="acct-caret">{dropdownOpen ? '▲' : '▼'}</span>}
            </button>
            {dropdownOpen && (
              <div className="acct-dropdown">
                {accounts.map((acct) => (
                  <button key={acct.id}
                    className={`acct-dropdown-item${acct.id === activeAccount?.id ? ' acct-dropdown-item--active' : ''}`}
                    onClick={() => handleSwitch(acct.id)}>
                    <span className="acct-dot" style={{ background: acct.color ?? '#4CAF50' }} />
                    <span>{acct.name}</span>
                    {acct.id === activeAccount?.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          className={`header-refresh-btn${refreshing ? ' header-refresh-btn--spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh all data"
          aria-label="Refresh all data"
        >
          <span className="header-refresh-icon">↺</span>
        </button>
        <button
          className="theme-toggle"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
