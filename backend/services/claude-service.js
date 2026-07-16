import { config } from '../config.js';

// Mock analysis text returned in Phase 1 (USE_CLAUDE_MOCK=true)
const mockAnalysis = {
  dailyBriefing: `
**AI Analysis — Daily Briefing (Mock Mode)**

Today's portfolio is shaped by two diverging stories: **Novo Nordisk's pullback** on renewed GLP-1 competitive pressure,
and **ASML's steady climb** on broadening AI-driven chip capex. These call for different postures — one cautious,
one constructive.

The ECB hold reinforces the macro environment: a gradual, data-dependent easing path favors quality over cyclicality.
Bitcoin's breakout above €56K is technically significant but still untested by a pullback — treat it as momentum
to watch, not chase.

**Recommended actions today:**
1. Hold NOVO-B — do not add until the stock finds a base above DKK 560
2. Consider adding to ASML on any pullback toward €900–€910
3. Monitor BTC for a confirmed hold above €56K before adding further
  `.trim(),

  weeklyReport: `
**AI Analysis — Weekly Deep Dive (Mock Mode)**

Portfolio delivered a mixed week overall, weighed down by NOVO-B (-4.0%) but supported by ASML (+0.6%) and BTC (+3.0%).
The underlying portfolio ex-NOVO-B is in solid shape with steady, unglamorous momentum led by the core IWDA/VWCE holdings.

The macro environment favors the current positioning in semiconductors (ASML), global equity (IWDA, VWCE),
and crypto (BTC). The ECB's cautious hold is a mild headwind for rate-sensitive names but doesn't change
the structural AI capex thesis underpinning ASML.

**Portfolio health assessment: STABLE** — with the caveat that NOVO-B needs to demonstrate a base before
its WATCH status can be upgraded. Addressing this position is the top monitoring item this week.
  `.trim(),
};

export async function generateAnalysis(type, data) {
  if (config.useMock) {
    return mockAnalysis[type] ?? 'Analysis not available in mock mode.';
  }

  // Phase 2: real Anthropic SDK call
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.apiKeys.anthropic });

  const prompts = {
    dailyBriefing: `You are an expert investing analyst. Analyze the following portfolio data and news,
then provide a concise daily briefing (5 min read) covering:
1. Significant portfolio moves and what they mean
2. Top macro events and their impact on holdings
3. Any immediate action recommendations
4. Overall market risk assessment

Portfolio data: ${JSON.stringify(data.portfolio, null, 2)}
News: ${JSON.stringify(data.news, null, 2)}

Be direct, confident, and actionable. No hedging language.`,

    weeklyReport: `You are an expert investing analyst. Analyze the following portfolio data and market context,
then provide a comprehensive weekly deep dive covering:
1. Portfolio performance review with context
2. Macro environment assessment
3. Technical analysis summary per position
4. Opportunities and risks for the coming week
5. Any position adjustments recommended

Data: ${JSON.stringify(data, null, 2)}

Be thorough, structured, and opinionated. Clearly distinguish fact from analysis.`,
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: 'You are a sharp, experienced investing analyst who gives direct, actionable assessments.',
    messages: [{ role: 'user', content: prompts[type] ?? prompts.dailyBriefing }],
  });

  return response.content[0].text;
}
