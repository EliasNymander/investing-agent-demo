const CLAUDE_KEYWORDS = [
  'weekly report', 'weekly digest', 'weekly summary',
  'deep analysis', 'deep dive', 'full analysis', 'detailed analysis',
  'long report', 'portfolio review', 'portfolio analysis',
  'should i buy', 'should i sell', 'worth buying', 'worth selling',
  'buy signal', 'sell signal', 'good time to buy', 'good time to sell',
  'tax implications', 'tax strategy', 'tax planning', 'tax scenario',
  'loss harvest', 'loss harvesting', 'tax efficient', 'tax efficiency',
  'investment strategy', 'long-term strategy', 'trading strategy',
  'rebalance', 'rebalancing', 'scenario', 'outlook', 'forecast',
  'opportunity', 'opportunities', 'macro', 'interest rate', 'what would happen',
];

export function classifyQuery(text) {
  const q = text.toLowerCase();
  return CLAUDE_KEYWORDS.some((k) => q.includes(k)) ? 'claude' : 'phi';
}
