import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import ChatMessage from './ChatMessage.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import BudgetWidget from './BudgetWidget.jsx';
import SuggestedQuestions from './SuggestedQuestions.jsx';
import { classifyQuery } from '../../utils/queryClassifier.js';
import { DEMO_MODE } from '../../api/demoFetch.js';

const DEMO_CHAT_MESSAGE =
  "Live AI chat isn't available in this demo — there's no backend behind it. Take a look at the " +
  "Dashboard, Signals, and Intelligence pages to see the data the agent would actually reason over.";

// ── Agent API call ─────────────────────────────────────────────────

function formatLocalResult(result) {
  if (!result) return 'No data available.';
  if (typeof result === 'string') return result;

  if (Array.isArray(result)) {
    return result.map((item) => {
      if (typeof item === 'string') return `• ${item}`;
      if (item.headline) return `**${item.headline}**${item.source ? ` — ${item.source}` : ''}${item.summary ? `\n${item.summary}` : ''}`;
      return `• ${JSON.stringify(item)}`;
    }).join('\n\n');
  }

  if (result.ticker && result.priceEur !== undefined) {
    const parts = [`**${result.ticker}**: €${result.priceEur.toFixed(2)}`];
    if (result.dailyPct !== undefined) parts.push(`(${result.dailyPct >= 0 ? '+' : ''}${result.dailyPct.toFixed(2)}% today)`);
    if (result.dataSource) parts.push(`_Source: ${result.dataSource}_`);
    return parts.join(' ');
  }

  if (result.ticker && result.price !== undefined && !result.rsi) {
    const parts = [`**${result.ticker}**: ${result.currency ?? 'USD'} ${result.price.toFixed(2)}`];
    if (result.changePct !== undefined) parts.push(`(${result.changePct >= 0 ? '+' : ''}${result.changePct.toFixed(2)}% today)`);
    if (result.dataSource) parts.push(`_Source: ${result.dataSource}_`);
    return parts.join(' ');
  }

  if (result.ticker && (result.rsi !== undefined || result.bbands)) {
    const lines = [`**${result.ticker} Technical Indicators**`];
    if (result.rsi != null) lines.push(`RSI(14): ${result.rsi.toFixed(1)}`);
    if (result.sma50 != null) lines.push(`SMA(50): ${result.sma50.toFixed(2)}`);
    if (result.sma200 != null) lines.push(`SMA(200): ${result.sma200.toFixed(2)}`);
    if (result.bbands) lines.push(`Bollinger: Upper ${result.bbands.upper.toFixed(2)} / Mid ${result.bbands.middle.toFixed(2)} / Lower ${result.bbands.lower.toFixed(2)}`);
    if (result.dataSource) lines.push(`_Source: ${result.dataSource}_`);
    return lines.join('\n');
  }

  return '```\n' + JSON.stringify(result, null, 2) + '\n```';
}

function formatAgentResult(result) {
  if (!result) return { type: 'normal', content: 'No response from agent.' };

  if (result.type === 'budget_blocked') {
    return { type: 'budget_blocked', content: `**Budget limit reached**: ${result.message ?? result.reason}`, deepAnalysisPackage: result.deepAnalysisPackage };
  }

  if (result.type === 'claude_response') {
    const parts = [];
    if (result.summary) parts.push(result.summary);
    if (result.analysis && result.analysis !== result.summary) parts.push(result.analysis);
    if (result.recommendation) parts.push(`**Recommendation:** ${result.recommendation}`);
    if (result.confidence) parts.push(`_Confidence: ${result.confidence}_`);
    return { type: 'normal', content: parts.join('\n\n') || 'No analysis available.' };
  }

  if (result.type === 'phi_fallback') {
    const text = result.summary ?? result.analysis ?? 'Fallback response unavailable.';
    return { type: 'normal', content: `${text}\n\n_Note: Answered by local model (Claude API unavailable)_` };
  }

  if (result.type === 'offline_fallback') {
    return { type: 'normal', content: 'Agent is currently offline. Please try again later.' };
  }

  if (result.type === 'local') {
    return { type: 'normal', content: formatLocalResult(result.result) };
  }

  return { type: 'normal', content: JSON.stringify(result, null, 2) };
}

async function callAgent(query) {
  if (DEMO_MODE) return { type: 'normal', content: DEMO_CHAT_MESSAGE };
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { type: 'normal', content: `Agent request failed (${res.status}). Please try again.` };
    const data = await res.json();
    if (!data.success) return { type: 'normal', content: 'Agent failed to process the request.' };
    return formatAgentResult(data.result);
  } catch (err) {
    return { type: 'normal', content: `Connection error: ${err.message}. Is the backend running?` };
  }
}

// ── Component ─────────────────────────────────────────────────────

export default function ChatPanel() {
  const { isOpen, close, clearMessages, messages, isTyping, setIsTyping, addMessage, registerSendMessage } = useChat();

  const bodyRef  = useRef(null);
  const inputRef = useRef(null);
  const [draft,        setDraft]        = useState('');
  const [typingModel,  setTypingModel]  = useState('phi');

  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    addMessage('user', trimmed);

    const model = classifyQuery(trimmed);
    setTypingModel(model);
    setIsTyping(true);

    const response = await callAgent(trimmed);
    setIsTyping(false);

    if (response.type === 'budget_blocked') {
      addMessage('agent', response.content, {
        type: 'budget_blocked',
        deepAnalysisPackage: response.deepAnalysisPackage,
      });
    } else {
      addMessage('agent', response.content);
    }
  }, [addMessage, isTyping, setIsTyping]);

  useEffect(() => {
    registerSendMessage(handleSend);
  }, [registerSendMessage, handleSend]);

  // Auto-scroll to bottom whenever messages or typing state change
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 220);
  }, [isOpen]);

  // Lock page scroll on mobile when panel is full-screen
  useEffect(() => {
    document.documentElement.classList.toggle('chat-open', isOpen);
    return () => document.documentElement.classList.remove('chat-open');
  }, [isOpen]);

  // ── Input handlers ───────────────────────────────────────────────

  function submit() {
    if (!draft.trim() || isTyping) return;
    handleSend(draft);
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = '38px';
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  // Auto-resize textarea up to ~5 lines
  function onInput(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    setDraft(el.value);
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div
      className={`chat-panel${isOpen ? ' chat-panel--open' : ''}`}
      role="dialog"
      aria-label="Investing Agent chat"
      aria-modal="false"
    >
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-title">
          <span className="chat-header-dot" />
          Investing Agent
        </div>
        <div className="chat-header-actions">
          <button className="chat-icon-btn" onClick={clearMessages} title="Clear conversation" aria-label="Clear conversation">
            <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="15" height="15">
              <path d="M3 4h12M7 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l1 11h6l1-11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="chat-icon-btn" onClick={close} title="Minimize" aria-label="Minimize chat">
            <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="15" height="15">
              <line x1="4" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Budget strip */}
      <BudgetWidget />

      {/* Suggestion chips */}
      <SuggestedQuestions onSelect={(q) => { handleSend(q); }} />

      {/* Message list */}
      <div className="chat-body" ref={bodyRef}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator model={typingModel} />}
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          placeholder="Ask about your portfolio…"
          aria-label="Message input"
          disabled={isTyping}
        />
        <button
          className="chat-send-btn"
          onClick={submit}
          disabled={!draft.trim() || isTyping}
          aria-label="Send message"
        >
          <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
            <path d="M15 9L3 3l2.5 6L3 15l12-6z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
