import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWatchlist } from '../../hooks/useWatchlist.js';
import { useSystemStatus } from '../../hooks/useSystemStatus.js';
import { DEMO_MODE } from '../../api/demoFetch.js';
import './Sidebar.css';

const VERDICT_LABEL = { live: 'LIVE DATA', partial: 'PARTIAL DATA', mock: 'MOCK DATA' };
const VERDICT_BADGE_CLASS = { live: 'badge-green', partial: 'badge-yellow', mock: 'badge-muted' };
const PROVIDER_LABEL = { alphaVantage: 'Alpha Vantage', coinGecko: 'CoinGecko', yahoo: 'Yahoo', fx: 'FX' };
const STATE_LABEL = { live: 'live', stale_cache: 'stale cache', mock: 'mock', error: 'error' };

// Raw per-provider strings pass through untouched so the tooltip explains the verdict
// (e.g. "Alpha Vantage: stale cache · CoinGecko: stale cache · FX: live").
function buildStatusTooltip(status) {
  if (!status) return 'Loading system status…';
  const parts = Object.entries(status.providers).map(
    ([key, val]) => `${PROVIDER_LABEL[key] ?? key}: ${STATE_LABEL[val] ?? val}`
  );
  const breakdown = parts.length ? parts.join(' · ') : 'No active data providers for current holdings';
  return status.demoMode ? `Demo mode active · ${breakdown}` : breakdown;
}

const nav = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/analytics', label: 'Analytics', icon: '◐', hideInDemo: true },
  { to: '/signals', label: 'Signals', icon: '◎' },
  { to: '/watchlist', label: 'Watchlist', icon: '◉', badge: 'watchlist', hideInDemo: true },
  { to: '/news', label: 'News Feed', icon: '◫' },
  { to: '/journal', label: 'Journal', icon: '◑', hideInDemo: true },
  { to: '/intelligence', label: 'Intel Feed', icon: '◆' },
  { to: '/tax', label: 'Tax Summary', icon: '⊞' },
  { to: '/alerts', label: 'Daily Alert', icon: '⊕' },
  { to: '/reports', label: 'Weekly Report', icon: '▤' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const { triggeredCount } = useWatchlist();
  const { status } = useSystemStatus();
  const verdict = status?.verdict ?? 'mock';
  const visibleNav = DEMO_MODE ? nav.filter((item) => !item.hideInDemo) : nav;

  return (
    <nav className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">◈</span>
        <span className="sidebar-logo-text">Investing<br />Agent</span>
      </div>
      <ul className="sidebar-nav">
        {visibleNav.map(({ to, label, icon, badge }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{icon}</span>
              <span>{label}</span>
              {badge === 'watchlist' && triggeredCount > 0 && (
                <span className="sidebar-badge">{triggeredCount}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <span
          className={`badge ${VERDICT_BADGE_CLASS[verdict]}`}
          title={buildStatusTooltip(status)}
        >
          {VERDICT_LABEL[verdict]}
        </span>
      </div>
    </nav>
  );
}
