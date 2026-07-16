import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mockPrices } from '../data/mock-prices.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALERTS_PATH = resolve(__dirname, '..', '..', 'price-alerts.json');

function load() {
  if (!existsSync(ALERTS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(ALERTS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function save(alerts) {
  writeFileSync(ALERTS_PATH, JSON.stringify(alerts, null, 2), 'utf8');
}

function evaluate(alert) {
  const priceData = mockPrices[alert.ticker];
  if (!priceData) {
    return { ...alert, triggered: false, currentPrice: null, dailyPct: null, distanceToTarget: null };
  }

  const currentPrice = priceData.price;
  const dailyPct     = priceData.dailyPct;
  let triggered      = false;
  let distanceToTarget = null;

  if (alert.type === 'price_target') {
    if (alert.condition === 'above') {
      triggered        = currentPrice >= alert.targetValue;
      distanceToTarget = currentPrice - alert.targetValue;
    } else if (alert.condition === 'below') {
      triggered        = currentPrice <= alert.targetValue;
      distanceToTarget = currentPrice - alert.targetValue;
    }
  } else if (alert.type === 'daily_pct_move') {
    const absPct = Math.abs(dailyPct ?? 0);
    if (alert.condition === 'up_pct') {
      triggered        = (dailyPct ?? 0) >= alert.targetValue;
      distanceToTarget = (dailyPct ?? 0) - alert.targetValue;
    } else if (alert.condition === 'down_pct') {
      triggered        = (dailyPct ?? 0) <= -alert.targetValue;
      distanceToTarget = Math.abs(dailyPct ?? 0) - alert.targetValue;
    }
  }

  return {
    ...alert,
    triggered,
    currentPrice,
    dailyPct,
    distanceToTarget: distanceToTarget != null ? +distanceToTarget.toFixed(4) : null,
  };
}

export function getPriceAlerts() {
  const alerts  = load();
  const enriched = alerts.map(evaluate);
  const triggeredCount = enriched.filter((a) => a.active && a.triggered).length;
  return { alerts: enriched, triggeredCount };
}

export function addPriceAlert(data) {
  const alerts = load();
  const newAlert = {
    id:          `pa-${Date.now()}`,
    type:        data.type        ?? 'price_target',
    condition:   data.condition   ?? 'above',
    ticker:      (data.ticker ?? '').toUpperCase(),
    name:        data.name        ?? data.ticker ?? '',
    targetValue: parseFloat(data.targetValue) || 0,
    currency:    data.currency    ?? 'USD',
    notifyVia:   Array.isArray(data.notifyVia) ? data.notifyVia : ['in_app'],
    email:       data.email       ?? null,
    notes:       data.notes       ?? '',
    active:      true,
    createdAt:   new Date().toISOString(),
  };
  alerts.push(newAlert);
  save(alerts);
  return evaluate(newAlert);
}

export function updatePriceAlert(id, patch) {
  const alerts = load();
  const idx = alerts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  if (patch.targetValue != null) patch.targetValue = parseFloat(patch.targetValue);
  if (patch.ticker)              patch.ticker = patch.ticker.toUpperCase();
  alerts[idx] = { ...alerts[idx], ...patch };
  save(alerts);
  return evaluate(alerts[idx]);
}

export function deletePriceAlert(id) {
  const alerts = load();
  save(alerts.filter((a) => a.id !== id));
  return true;
}
