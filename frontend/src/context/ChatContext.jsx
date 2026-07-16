import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ChatContext = createContext(null);

function makeInitialMessages() {
  return [
    {
      id: 'welcome',
      role: 'agent',
      content:
        "Hi! I'm your investing agent. I have full visibility into your portfolio across **KvarnX**, **Nordnet**, and **Nordea**.\n\n" +
        "Ask me about your positions, today's performance, active signals, or anything market-related.",
      timestamp: new Date(),
    },
  ];
}

export function ChatProvider({ children }) {
  const [isOpen,    setIsOpen]    = useState(false);
  const [messages,  setMessages]  = useState(makeInitialMessages);
  const [isTyping,  setIsTyping]  = useState(false);

  // ChatPanel injects its sendMessage implementation here once mounted
  const sendMessageRef = useRef(null);

  const toggle = useCallback(() => setIsOpen((p) => !p), []);
  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);

  const clearMessages = useCallback(() => setMessages(makeInitialMessages()), []);

  const addMessage = useCallback((role, content, extras = {}) => {
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      timestamp: new Date(),
      ...extras,
    };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }, []);

  const registerSendMessage = useCallback((fn) => {
    sendMessageRef.current = fn;
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (sendMessageRef.current) await sendMessageRef.current(text);
  }, []);

  return (
    <ChatContext.Provider value={{
      isOpen, toggle, open, close,
      messages, isTyping, setIsTyping,
      sendMessage, clearMessages, addMessage,
      registerSendMessage,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be inside <ChatProvider>');
  return ctx;
}
