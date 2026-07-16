import React, { useState } from 'react';

const PREVIEW_LINES = 10;

export default function DeepAnalysisCard({ message }) {
  const [expanded,  setExpanded]  = useState(false);
  const [copied,    setCopied]    = useState(false);

  const pkg   = message.deepAnalysisPackage ?? '';
  const lines = pkg.split('\n');
  const hasMore = lines.length > PREVIEW_LINES;
  const display = expanded ? pkg : lines.slice(0, PREVIEW_LINES).join('\n');

  function handleCopy() {
    navigator.clipboard.writeText(pkg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function handleDownload() {
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([pkg], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `deep-analysis-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="chat-msg chat-msg--agent">
      <div className="deep-analysis-card">
        {/* Header */}
        <div className="deep-analysis-header">
          <span className="deep-analysis-icon" aria-hidden>📦</span>
          <div>
            <div className="deep-analysis-title">Deep Analysis Package</div>
            <div className="deep-analysis-subtitle">Paste this into Claude.ai for a full analysis</div>
          </div>
        </div>

        {/* Budget reason */}
        <p className="deep-analysis-reason">{message.content}</p>

        {/* Collapsible package preview */}
        <div className={`deep-analysis-preview-wrap${!expanded && hasMore ? ' deep-analysis-preview-wrap--faded' : ''}`}>
          <pre className="deep-analysis-preview">{display}</pre>
        </div>

        {hasMore && (
          <button className="deep-analysis-expand" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show less ▲' : `Show full package ▼ (${lines.length} lines)`}
          </button>
        )}

        {/* Action buttons */}
        <div className="deep-analysis-actions">
          <button
            className={`deep-analysis-btn deep-analysis-btn--primary${copied ? ' deep-analysis-btn--copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Copied' : '📋 Copy Package'}
          </button>
          <button className="deep-analysis-btn" onClick={handleDownload}>
            📥 Download .txt
          </button>
        </div>
      </div>

      <div className="chat-msg-time">
        {message.timestamp instanceof Date
          ? message.timestamp.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
          : ''}
      </div>
    </div>
  );
}
