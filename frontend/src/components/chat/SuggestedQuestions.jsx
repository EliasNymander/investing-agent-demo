import React from 'react';

const DEFAULT_SUGGESTIONS = [
  "What should I do with my portfolio today?",
  "What are my biggest risks right now?",
  "Show me my best and worst performers",
  "What's the market saying today?",
];

export default function SuggestedQuestions({ onSelect }) {
  return (
    <div className="chat-suggestions">
      {DEFAULT_SUGGESTIONS.map((q) => (
        <button
          key={q}
          className="chat-suggestion-chip"
          onClick={() => onSelect(q)}
          type="button"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
