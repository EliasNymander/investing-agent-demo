export const mockNews = [
  {
    id: 'news-001',
    headline: 'Novo Nordisk Slides ~4% as GLP-1 Competitive Pressure Weighs on Sentiment',
    source: 'Reuters',
    publishedAt: '2026-05-12T08:30:00Z',
    category: 'sector',
    impactRating: 'HIGH',
    tickers: ['NOVO-B'],
    summary:
      'Novo Nordisk shares fell roughly 4% in Copenhagen trading as investors weighed intensifying competition from rival GLP-1 drug developers, alongside a broader cooling in obesity-drug valuations after an extended run. Volumes were elevated but no company-specific news drove the move.',
    portfolioImpact:
      'Directly negative for the NOVO-B position today. The pullback looks like a valuation reset rather than a change in the long-term GLP-1 leadership thesis — worth watching for a base before adding, per the current WATCH signal.',
  },
  {
    id: 'news-002',
    headline: 'ASML Extends Steady Climb as AI-Driven Chip Capex Cycle Broadens',
    source: 'Bloomberg',
    publishedAt: '2026-05-12T17:30:00Z',
    category: 'sector',
    impactRating: 'MEDIUM',
    tickers: ['ASML'],
    summary:
      'ASML shares rose modestly as major foundry and chipmaker customers reiterated elevated 2026–2027 capital expenditure plans tied to advanced-node and AI accelerator production. ASML remains the sole global supplier of extreme ultraviolet (EUV) lithography systems required for the most advanced chips.',
    portfolioImpact:
      'Constructive for the ASML position. Order visibility from major foundry customers supports the existing BUY signal and the case for accumulating on any near-term weakness.',
  },
  {
    id: 'news-003',
    headline: 'Bitcoin Breaks Above €56,000 Resistance on Renewed Institutional Buying',
    source: 'CoinDesk',
    publishedAt: '2026-05-12T14:20:00Z',
    category: 'crypto',
    impactRating: 'MEDIUM',
    tickers: ['BTC'],
    summary:
      'Bitcoin rose roughly 3% to break through the €56,000 resistance level on volume well above its 30-day average, with several large European ETF products reporting their strongest inflow day in weeks. Options markets showed increased call-side interest for late-May expiries.',
    portfolioImpact:
      'Positive near-term for the BTC position, though the move is fresh and untested by a pullback — consistent with the current WATCH stance rather than a signal to add aggressively.',
  },
  {
    id: 'news-004',
    headline: 'ECB Holds Deposit Rate at 2.5%, Lagarde Signals Cautious Path Through H2',
    source: 'Reuters',
    publishedAt: '2026-05-14T11:00:00Z',
    category: 'macro',
    impactRating: 'MEDIUM',
    tickers: [],
    summary:
      'The European Central Bank left its key deposit rate unchanged at 2.5% at today\'s policy meeting. President Christine Lagarde reiterated a data-dependent approach and pushed back on market expectations for a rapid string of cuts, noting services inflation remains "too high" at just under 4%.',
    portfolioImpact:
      'A hold with a cautious tone is broadly neutral for EUR-denominated holdings — it limits near-term downside for the Nordea funds while capping upside from a faster rate-cut cycle.',
  },
  {
    id: 'news-005',
    headline: 'US Payrolls Miss Forces Faster Fed Cut Bets — Euro Strengthens to 1.095',
    source: 'Bloomberg',
    publishedAt: '2026-05-13T15:30:00Z',
    category: 'macro',
    impactRating: 'LOW',
    tickers: [],
    summary:
      'US non-farm payrolls rose by 142,000 in April, well below the 185,000 consensus estimate. Fed funds futures shifted to price in two 25bps rate cuts by year-end, up from one previously, and the euro rose 0.8% against the dollar to 1.095 as the dollar weakened broadly.',
    portfolioImpact:
      'A weaker dollar and firmer rate-cut expectations are broadly supportive of global risk appetite, though a stronger euro is a mild headwind for USD- and DKK-denominated holdings when translated back to EUR.',
  },
  {
    id: 'news-006',
    headline: 'Shell Reiterates Buyback Pace as Brent Holds Near $78',
    source: 'Financial Times',
    publishedAt: '2026-05-12T09:15:00Z',
    category: 'earnings',
    impactRating: 'LOW',
    tickers: ['SHEL'],
    summary:
      'Shell confirmed it will maintain its current quarterly share buyback pace after Brent crude held broadly steady near $78 per barrel. Management pointed to disciplined capital allocation and a continued focus on cash generation from its integrated gas and upstream businesses.',
    portfolioImpact:
      'Roughly neutral for the SHEL position today — steady buyback commitments support the shares near current levels without providing a fresh catalyst either way.',
  },
  {
    id: 'news-007',
    headline: 'Global Equity ETFs See Third Straight Week of Inflows as Volatility Eases',
    source: 'Morningstar',
    publishedAt: '2026-05-12T07:00:00Z',
    category: 'sector',
    impactRating: 'MEDIUM',
    tickers: ['IWDA', 'VWCE'],
    summary:
      'Broad global equity ETFs, including major MSCI World and FTSE All-World trackers, attracted a third consecutive week of net inflows as the VIX fell to its lowest level since January 2025. European-listed UCITS funds saw particularly strong demand from both retail and institutional investors.',
    portfolioImpact:
      'Positive technical backdrop for the core IWDA and VWCE holdings — steady, broad-based inflows support continued gradual appreciation without signaling anything extended or frothy.',
  },
  {
    id: 'news-008',
    headline: 'Riksbank Holds Key Rate at 2.25%, Signals Gradual Path for Remaining 2026 Cuts',
    source: 'Dagens Industri',
    publishedAt: '2026-05-09T08:00:00Z',
    category: 'macro',
    impactRating: 'LOW',
    tickers: [],
    summary:
      'Sweden\'s Riksbank left its policy rate unchanged at 2.25%, in line with expectations, and signaled a gradual, data-dependent approach to any further cuts this year. Governor Erik Thedéen cited resilient domestic demand and still-elevated services inflation as reasons for caution.',
    portfolioImpact:
      'A steady, predictable Swedish rate path is a mild net positive for SEK-denominated holdings, reducing the risk of a surprise policy shift in either direction.',
  },
];

export const mockMacroSummary = `
**Macro Snapshot — May 14, 2026**

This week's dominant theme is central bank caution meeting resilient underlying growth. The ECB's hold at 2.5% was widely expected, but Lagarde's data-dependent tone pushed market expectations for the next cut out to September at the earliest. Meanwhile a soft US payrolls report brought forward Fed rate-cut expectations to two cuts by year-end, weakening the dollar and lifting EUR/USD to 1.095 — a mild tailwind for EUR-denominated holdings.

In the Nordics, the Riksbank held its policy rate steady and signaled a gradual approach for the rest of 2026, keeping the backdrop for SEK-denominated holdings stable. Novo Nordisk's ~4% pullback on GLP-1 competitive concerns was the standout single-name move of the week — more a valuation reset than a change in the underlying leadership thesis, but worth watching for a base before adding.

Bitcoin's breakout above €56,000 on renewed institutional demand was the other headline mover, continuing a broader constructive turn in crypto-market sentiment as total market capitalization pushed back above €3.6 trillion.

**Key macro events this week:**
- 🔴 ECB rate hold (2.5%) — cautious tone pushes next cut expectations to September
- 🟢 US payrolls miss — Fed cut expectations brought forward, EUR strengthens
- 🟡 Riksbank holds at 2.25% — gradual path signaled for remaining 2026 cuts
- 🔴 Novo Nordisk -4% on GLP-1 competitive pressure — valuation reset, not thesis break
- 🟢 Bitcoin breaks €56K resistance — institutional demand broadening

**ECB policy impact on portfolio: MEDIUM**
**Overall market risk appetite: MODERATE**
`;
