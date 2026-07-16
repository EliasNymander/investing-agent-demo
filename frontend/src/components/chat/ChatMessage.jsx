import React from 'react';
import { Link } from 'react-router-dom';
import DeepAnalysisCard from './DeepAnalysisCard.jsx';

// ── Mini markdown renderer ────────────────────────────────────────
// Supports: **bold**, *italic*, - list items, paragraph breaks

function applyInline(text) {
  // Split on **...** and *...*
  const parts = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith('**')) {
      parts.push(<strong key={m.index}>{m[2]}</strong>);
    } else {
      parts.push(<em key={m.index}>{m[3]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function renderContent(raw) {
  if (!raw) return null;
  const blocks = raw.split(/\n{2,}/);

  return blocks.map((block, bi) => {
    const lines = block.split('\n');
    const isListBlock = lines.every((l) => /^[-•]\s/.test(l.trim()) || l.trim() === '');
    if (isListBlock) {
      return (
        <ul key={bi}>
          {lines.filter((l) => l.trim()).map((l, li) => (
            <li key={li}>{applyInline(l.replace(/^[-•]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }
    // Mixed block: some list lines, some plain
    const hasListLines = lines.some((l) => /^[-•]\s/.test(l.trim()));
    if (hasListLines) {
      return (
        <div key={bi}>
          {lines.map((l, li) => {
            if (/^[-•]\s/.test(l.trim())) {
              return <ul key={li} style={{ margin: '2px 0' }}><li>{applyInline(l.replace(/^[-•]\s+/, ''))}</li></ul>;
            }
            if (!l.trim()) return null;
            return <p key={li}>{applyInline(l)}</p>;
          })}
        </div>
      );
    }
    // Plain paragraph — join lines with a space (word-wrap handles display)
    return <p key={bi}>{applyInline(lines.join(' '))}</p>;
  });
}

function fmtTime(date) {
  return date instanceof Date
    ? date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
    : '';
}

// ── Component ─────────────────────────────────────────────────────

export default function ChatMessage({ message }) {
  if (message.type === 'budget_blocked') {
    return <DeepAnalysisCard message={message} />;
  }

  const { role, content, timestamp, links } = message;

  return (
    <div className={`chat-msg chat-msg--${role}`}>
      <div className="chat-msg-bubble">
        {renderContent(content)}

        {/* Optional "View X page →" links embedded in agent messages */}
        {links?.length > 0 && (
          <div className="chat-msg-links">
            {links.map((lk) => (
              <Link key={lk.to} to={lk.to} className="chat-asset-link">
                {lk.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="chat-msg-time">{fmtTime(timestamp)}</div>
    </div>
  );
}
