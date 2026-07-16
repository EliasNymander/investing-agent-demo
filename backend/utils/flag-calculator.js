const THRESHOLDS = {
  stock: 0.05,
  etf: 0.03,
  fund: 0.03,
  crypto: 0.05,
};

export function getFlag(dailyPct, assetClass) {
  const threshold = THRESHOLDS[assetClass] ?? 0.05;
  const abs = Math.abs(dailyPct) / 100;
  if (abs >= threshold) {
    return { active: true, direction: dailyPct > 0 ? 'up' : 'down', pct: dailyPct };
  }
  return { active: false, direction: null, pct: dailyPct };
}
