import React from 'react';

// model: 'phi' (default three-dot indicator) | 'claude' (dots + label)
export default function TypingIndicator({ model = 'phi' }) {
  const isClaude = model === 'claude';
  return (
    <div
      className={`chat-typing${isClaude ? ' chat-typing--claude' : ''}`}
      aria-label={isClaude ? 'Thinking deeply…' : 'Agent is thinking'}
    >
      <div className="chat-typing-dot" />
      <div className="chat-typing-dot" />
      <div className="chat-typing-dot" />
      {isClaude && <span className="chat-typing-label">Thinking deeply…</span>}
    </div>
  );
}
