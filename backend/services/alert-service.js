import { mockNews, mockMacroSummary } from '../data/mock-news.js';

const IMPACT_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export async function getDailyAlert() {
  const sorted = [...mockNews].sort(
    (a, b) => (IMPACT_ORDER[a.impactRating] ?? 99) - (IMPACT_ORDER[b.impactRating] ?? 99)
  );

  const topHeadlines = sorted.slice(0, 3);

  const highImpact = sorted.filter((n) => n.impactRating === 'HIGH');
  const overallImpact = highImpact.length >= 2 ? 'HIGH' : highImpact.length === 1 ? 'MEDIUM' : 'LOW';

  return {
    date: new Date().toISOString().split('T')[0],
    macroSummary: mockMacroSummary,
    overallMacroImpact: overallImpact,
    topHeadlines,
    news: sorted,
    generatedAt: new Date().toISOString(),
  };
}
