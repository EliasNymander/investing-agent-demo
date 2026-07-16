import { fxRates } from '../data/mock-prices.js';

export function toEur(amount, currency) {
  switch (currency) {
    case 'EUR': return amount;
    case 'USD': return amount * fxRates.USD_EUR;
    case 'SEK': return amount * fxRates.SEK_EUR;
    case 'NOK': return amount * fxRates.NOK_EUR;
    case 'GBP': return amount * fxRates.GBP_EUR;
    default: return amount;
  }
}

export function formatEur(amount) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
}

export function formatPct(pct) {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
