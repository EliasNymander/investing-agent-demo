import React from 'react';
import { useChat } from '../../context/ChatContext.jsx';

export default function ChatButton() {
  const { isOpen, toggle } = useChat();

  return (
    <button
      className={`chat-fab${isOpen ? ' chat-fab--open' : ''}`}
      onClick={toggle}
      aria-label={isOpen ? 'Close investing agent' : 'Open investing agent'}
      title={isOpen ? 'Close agent chat' : 'Ask your investing agent'}
    >
      {isOpen ? (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="chat-fab-svg">
          <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="chat-fab-svg">
          {/* Chat bubble */}
          <path
            d="M3 4a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H7l-4 3V4z"
            fill="currentColor" opacity="0.18"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
          />
          {/* Brain/circuit dots inside */}
          <circle cx="8"  cy="9" r="1.1" fill="currentColor"/>
          <circle cx="11" cy="9" r="1.1" fill="currentColor"/>
          <circle cx="14" cy="9" r="1.1" fill="currentColor"/>
        </svg>
      )}
    </button>
  );
}
