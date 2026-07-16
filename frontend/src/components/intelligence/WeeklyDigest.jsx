import React, { useState } from 'react';
import './WeeklyDigest.css';

export default function WeeklyDigest({ digest }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!digest) return null;

  return (
    <div className="weekly-digest">
      <div className="weekly-digest-header">
        <div className="weekly-digest-header-left">
          <span className="weekly-digest-badge">WEEKLY DIGEST</span>
          <span className="weekly-digest-title">{digest.headline}</span>
        </div>
        <button
          className="weekly-digest-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand digest' : 'Collapse digest'}
        >
          {collapsed ? '▼ Expand' : '▲ Collapse'}
        </button>
      </div>

      {!collapsed && (
        <p className="weekly-digest-body">{digest.body}</p>
      )}
    </div>
  );
}
