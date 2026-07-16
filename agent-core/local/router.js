// agent-core/local/router.js

// Keywords that indicate a query needs Claude's deep reasoning.
// Grouped by category — each entry must match as a substring of the lowercased query.
//
// Design rules:
//   - Prefer phrases over single words to avoid false escalations
//   - Simple data reads (prices, summaries, lookups) stay with Phi-3.5
//   - Reserve Claude for multi-factor reasoning, analysis, and planning tasks
const ESCALATION_KEYWORDS = [
  // ── Reports & analysis ─────────────────────────────────────────────────────
  'weekly report', 'weekly digest', 'weekly summary',
  'deep analysis', 'deep dive', 'full analysis', 'detailed analysis',
  'long report',
  'portfolio review', 'portfolio analysis',

  // ── Buy / sell decisions ───────────────────────────────────────────────────
  'should i buy', 'should i sell',
  'worth buying', 'worth selling',
  'buy signal', 'sell signal',
  'good time to buy', 'good time to sell',

  // ── Tax reasoning (specific phrases — simple "show tax summary" stays local)
  'tax implications', 'tax strategy', 'tax planning', 'tax scenario',
  'loss harvest', 'loss harvesting',
  'tax efficient', 'tax efficiency',

  // ── Strategy & planning (specific phrases — bare "strategy" stays local) ──
  'investment strategy', 'long-term strategy', 'trading strategy',
  'rebalance', 'rebalancing',
  'scenario',
  'outlook', 'forecast',

  // ── Opportunities & research ───────────────────────────────────────────────
  'opportunity', 'opportunities',

  // ── Macro & multi-factor ───────────────────────────────────────────────────
  'macro',
  'interest rate',
  'what would happen',
];

export function shouldUseClaude(task) {
  const q = task.toLowerCase();
  return ESCALATION_KEYWORDS.some(k => q.includes(k));
}

// Returns the matched keyword for logging / debugging — null if no match.
export function getEscalationReason(task) {
  const q = task.toLowerCase();
  return ESCALATION_KEYWORDS.find(k => q.includes(k)) ?? null;
}
