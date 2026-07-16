import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, useConfig } from './context/ConfigContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import ChatButton from './components/chat/ChatButton.jsx';
import ChatPanel from './components/chat/ChatPanel.jsx';
import DemoModeBanner from './components/DemoModeBanner.jsx';
import './components/chat/chat.css';
import Layout from './components/layout/Layout.jsx';
import SetupWizard from './components/wizard/SetupWizard.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SignalsPage from './pages/SignalsPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import PlatformPage from './pages/PlatformPage.jsx';
import WatchlistPage from './pages/WatchlistPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import JournalPage from './pages/JournalPage.jsx';
import IntelligencePage from './pages/IntelligencePage.jsx';
import TaxPage from './pages/TaxPage.jsx';

function AppInner() {
  const { config, loading } = useConfig();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!config?.setupComplete) {
    return <SetupWizard />;
  }

  return (
    <>
      <DemoModeBanner />
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/platform/:platformId" element={<PlatformPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/tax" element={<TaxPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      {/* Chat sits outside <Layout> and <Routes> — never unmounts on navigation */}
      <ChatButton />
      <ChatPanel />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ConfigProvider>
          <ChatProvider>
            <AppInner />
          </ChatProvider>
        </ConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
