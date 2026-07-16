import { getPortfolioHistory } from './history-service.js';

// ── Benchmarks catalogue ─────────────────────────────────────────────────────
const BENCHMARKS = [
  { id: 'sp500',     name: 'S&P 500',     desc: 'US large-cap',            annualReturn: 0.24, vol: 0.012, seed: 5001 },
  { id: 'omxh25',   name: 'OMXH25',      desc: 'Helsinki top 25',         annualReturn: 0.08, vol: 0.010, seed: 5002 },
  { id: 'msciWorld', name: 'MSCI World', desc: 'Global developed markets', annualReturn: 0.22, vol: 0.010, seed: 5003 },
];

// ── Seeded PRNG (same algorithm as history-service) ──────────────────────────
function seededRng(seed) {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0xffffffff;
  };
}

// Brownian bridge: path from startPrice → endPrice in n steps
function brownianBridge(startPrice, endPrice, n, vol, rng) {
  const increments = Array.from({ length: n }, () => (rng() - 0.5) * 2 * vol);
  const cumsum = increments.reduce((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v);
    return acc;
  }, []);
  const totalCum = cumsum[n - 1];
  return Array.from({ length: n }, (_, i) => {
    const trend  = startPrice + ((endPrice - startPrice) * i) / (n - 1);
    const bridge = (cumsum[i] - totalCum * (i / (n - 1))) * startPrice;
    return Math.max(trend + bridge, startPrice * 0.1);
  });
}

// ── Generate a normalized return series for one benchmark ────────────────────
// Returns n values representing cumulative % return (starting at 0.0).
function benchmarkReturnSeries(b, n, periodYearFraction) {
  const periodReturn = Math.pow(1 + b.annualReturn, periodYearFraction) - 1;
  const rng = seededRng(b.seed + n); // seed varies by period so shapes differ
  // Bridge in price-space (normalized: start=100, end=100*(1+periodReturn))
  const startVal = 100;
  const endVal   = 100 * (1 + periodReturn);
  const prices   = brownianBridge(startVal, endVal, n, b.vol, rng);
  return prices.map((p) => +((p - startVal) / startVal * 100).toFixed(3));
}

// ── Public API ───────────────────────────────────────────────────────────────
const YEAR_FRACTIONS = { '1W': 5 / 260, '1M': 22 / 260, '3M': 66 / 260, '6M': 130 / 260, '1Y': 1 };

export async function getBenchmarkComparison(period) {
  const validPeriod = YEAR_FRACTIONS[period] ? period : '1Y';
  const yearFraction = YEAR_FRACTIONS[validPeriod];

  // Portfolio history (weekday-only, all holdings)
  const portHistory = getPortfolioHistory(validPeriod);
  if (!portHistory.length) return null;

  const portStart = portHistory[0].value;
  const portEnd   = portHistory[portHistory.length - 1].value;
  const n         = portHistory.length;

  // Normalize portfolio to % return from period start
  const portReturns = portHistory.map((p) => +((p.value - portStart) / portStart * 100).toFixed(3));
  const portFinalReturn = portReturns[n - 1];

  // Generate benchmark series of exactly n points
  const benchmarkSeries = BENCHMARKS.map((b) => ({
    b,
    returns: benchmarkReturnSeries(b, n, yearFraction),
  }));

  // Build unified time series for the chart
  const series = portHistory.map((p, i) => {
    const point = { date: p.date, portfolio: portReturns[i] };
    for (const { b, returns } of benchmarkSeries) {
      point[b.id] = returns[i];
    }
    return point;
  });

  // Summary per benchmark
  const benchmarks = benchmarkSeries.map(({ b, returns }) => {
    const benchReturn = returns[n - 1];
    return {
      id:            b.id,
      name:          b.name,
      desc:          b.desc,
      periodReturn:  +benchReturn.toFixed(2),
      delta:         +(portFinalReturn - benchReturn).toFixed(2),
      outperforming: portFinalReturn > benchReturn,
    };
  });

  const outperformingCount = benchmarks.filter((b) => b.outperforming).length;

  return {
    period: validPeriod,
    portfolioReturn: +portFinalReturn.toFixed(2),
    series,
    benchmarks,
    verdict: outperformingCount === BENCHMARKS.length
      ? 'beating_all'
      : outperformingCount === 0
        ? 'lagging_all'
        : 'mixed',
  };
}
