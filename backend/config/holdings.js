// backend/config/holdings.js
//
// Account-aware portfolio holdings.
// Reads/writes to backend/data/accounts/account-[id].json.
// All services that call getHoldings() with no args continue to work unchanged —
// they automatically read the active account.
// Migration from user-holdings.json runs once, synchronously, at module load.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isDemoMode } from './demo-mode.js';
import { mockPortfolio } from '../data/mock-portfolio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR            = resolve(__dirname, '..', 'data');
const ACCOUNTS_DIR        = resolve(DATA_DIR, 'accounts');
const ACCOUNTS_INDEX      = resolve(ACCOUNTS_DIR, 'accounts-index.json');
const ACTIVE_ACCOUNT_FILE = resolve(ACCOUNTS_DIR, 'active-account.json');
const MIGRATION_LOG       = resolve(ACCOUNTS_DIR, 'migration-log.json');
const HOLDINGS_FILE       = resolve(DATA_DIR, 'user-holdings.json');       // legacy — migration source only
const BACKUP_FILE         = resolve(DATA_DIR, 'user-holdings.backup.json');

const PLATFORMS           = ['nordnet', 'nordea', 'kvarnx'];
const VALID_ASSET_CLASSES = ['stock','etf','fund','crypto','bond','reit','commodity','warrant','certificate','other'];
const PURCHASE_DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;

function isValidPurchaseDate(value) {
  if (!PURCHASE_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value; // rejects e.g. 2026-02-30
}

// Local calendar date (not UTC) — avoids rejecting "today" purchases entered
// near midnight in timezones ahead of UTC (this app runs locally in Helsinki).
function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const KNOWN_COINGECKO_IDS = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', LINK:'chainlink',
  BNB:'binancecoin', ADA:'cardano', DOT:'polkadot', AVAX:'avalanche-2',
  MATIC:'matic-network', UNI:'uniswap', ATOM:'cosmos', XRP:'ripple',
  LTC:'litecoin', DOGE:'dogecoin', SHIB:'shiba-inu', FTM:'fantom',
  NEAR:'near', APT:'aptos', OP:'optimism', ARB:'arbitrum',
};

const EMPTY_HOLDINGS = {
  displayCurrency: 'EUR',
  nordnet: [], nordea: [], kvarnx: [],
  lastUpdated: null,
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function accountFilePath(id) {
  return resolve(ACCOUNTS_DIR, `account-${id}.json`);
}

function readHoldingsFile(filePath) {
  if (!existsSync(filePath)) return structuredClone(EMPTY_HOLDINGS);
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8').replace(/^﻿/, ''));
    return {
      displayCurrency: raw.displayCurrency ?? 'EUR',
      nordnet:     Array.isArray(raw.nordnet)  ? raw.nordnet  : [],
      nordea:      Array.isArray(raw.nordea)   ? raw.nordea   : [],
      kvarnx:      Array.isArray(raw.kvarnx)   ? raw.kvarnx   : [],
      lastUpdated: raw.lastUpdated ?? null,
    };
  } catch { return structuredClone(EMPTY_HOLDINGS); }
}

function readAccountsIndex() {
  try { return JSON.parse(readFileSync(ACCOUNTS_INDEX, 'utf-8')); }
  catch { return { accounts: [], schemaVersion: '1.0' }; }
}

function writeAccountsIndex(data) {
  writeFileSync(ACCOUNTS_INDEX, JSON.stringify(data, null, 2), 'utf-8');
}

function computeIndexMetadata(holdingsData) {
  const all = [...(holdingsData.nordnet ?? []), ...(holdingsData.nordea ?? []), ...(holdingsData.kvarnx ?? [])];
  return {
    holdingCount: all.length,
    platforms: PLATFORMS.filter(p => holdingsData[p]?.length > 0),
  };
}

// ── Migration (runs once synchronously at module load) ────────────────────────

function runMigrationIfNeeded() {
  if (existsSync(ACCOUNTS_DIR)) return;  // already migrated

  mkdirSync(ACCOUNTS_DIR, { recursive: true });

  const existingHoldings = existsSync(HOLDINGS_FILE)
    ? readHoldingsFile(HOLDINGS_FILE)
    : structuredClone(EMPTY_HOLDINGS);

  const { holdingCount, platforms } = computeIndexMetadata(existingHoldings);
  const now = new Date().toISOString();

  // Write account-acc_1.json
  writeFileSync(accountFilePath('acc_1'), JSON.stringify({ ...existingHoldings, lastUpdated: now }, null, 2), 'utf-8');

  // Write accounts-index.json
  writeAccountsIndex({
    accounts: [{
      id: 'acc_1', name: 'Personal Portfolio', description: '',
      createdAt: now, lastUpdated: now, color: '#4CAF50',
      holdingCount, platforms,
    }],
    schemaVersion: '1.0',
  });

  // Write active-account.json
  writeFileSync(ACTIVE_ACCOUNT_FILE, JSON.stringify({ activeAccountId: 'acc_1', setAt: now }, null, 2), 'utf-8');

  // Rename source file to backup (only if it existed)
  if (existsSync(HOLDINGS_FILE)) renameSync(HOLDINGS_FILE, BACKUP_FILE);

  // Write migration log
  writeFileSync(MIGRATION_LOG, JSON.stringify({
    migratedAt: now, sourceFile: 'user-holdings.json',
    targetAccount: 'acc_1', holdingCount, schemaVersion: '1.0',
  }, null, 2), 'utf-8');

  console.log(`[holdings] Migration complete — ${holdingCount} holding(s) moved to account acc_1`);
}

runMigrationIfNeeded();

// ── Demo mode ─────────────────────────────────────────────────────────────────

function normalizeDemoHolding(h) {
  const { qty, coinGeckoId, ...rest } = h;
  return { ...rest, units: qty ?? rest.units ?? 0, purchaseDate: rest.purchaseDate ?? null, ...(coinGeckoId ? { coingeckoId: coinGeckoId } : {}) };
}

function getDemoHoldings() {
  return {
    displayCurrency: 'EUR',
    nordnet: (mockPortfolio.nordnet ?? []).map(normalizeDemoHolding),
    nordea:  (mockPortfolio.nordea  ?? []).map(normalizeDemoHolding),
    kvarnx:  (mockPortfolio.kvarnx  ?? []).map(normalizeDemoHolding),
    lastUpdated: null,
  };
}

// ── Account reads ─────────────────────────────────────────────────────────────

export function getAccounts() {
  return readAccountsIndex();
}

export function getActiveAccountId() {
  try {
    const raw = JSON.parse(readFileSync(ACTIVE_ACCOUNT_FILE, 'utf-8'));
    return raw.activeAccountId ?? 'acc_1';
  } catch { return 'acc_1'; }
}

export function getActiveAccount() {
  const id = getActiveAccountId();
  const index = readAccountsIndex();
  return index.accounts.find(a => a.id === id) ?? null;
}

// ── Derived totals from purchase lots ─────────────────────────────────────────
//
// units/avgCost/currency/purchaseDate are never stored — only `lots` is. These
// are computed fresh on every read so downstream callers (analytics, portfolio,
// reports, dashboard, etc.) keep reading holding.units/.avgCost unchanged.
// No rounding anywhere in this path — units carry fractional-share precision
// (e.g. savings-plan buys like 165.6054 units) all the way through.

function deriveHoldingTotals(lots) {
  const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units ?? 0), 0);
  const totalCost  = lots.reduce((sum, lot) => sum + Number(lot.totalCost ?? 0), 0);
  const avgCost    = totalUnits > 0 ? totalCost / totalUnits : 0;
  const purchaseDate = lots.reduce(
    (earliest, lot) => (!earliest || lot.purchaseDate < earliest) ? lot.purchaseDate : earliest,
    null,
  );
  return { units: totalUnits, avgCost, currency: lots[0]?.currency ?? null, purchaseDate };
}

// No-op for holdings without lots (demo-mode mock data, which keeps its own
// flat qty/avgCost shape untouched) — only enriches when lots is populated.
function enrichHoldingWithDerivedTotals(h) {
  if (!Array.isArray(h.lots) || h.lots.length === 0) return h;
  return { ...h, ...deriveHoldingTotals(h.lots) };
}

// ── Holdings reads (zero-arg callers unchanged) ───────────────────────────────

export function getHoldings(accountId) {
  const raw = isDemoMode()
    ? getDemoHoldings()
    : readHoldingsFile(accountFilePath(accountId ?? getActiveAccountId()));
  return {
    ...raw,
    nordnet: raw.nordnet.map(enrichHoldingWithDerivedTotals),
    nordea:  raw.nordea.map(enrichHoldingWithDerivedTotals),
    kvarnx:  raw.kvarnx.map(enrichHoldingWithDerivedTotals),
  };
}

export function getHoldingsByPlatform(platform) {
  const h = getHoldings();
  return Array.isArray(h[platform]) ? h[platform] : [];
}

export function getAllHoldings() {
  const h = getHoldings();
  return [...(h.nordnet ?? []), ...(h.nordea ?? []), ...(h.kvarnx ?? [])];
}

export function getHoldingsByAssetClass(assetClass) {
  return getAllHoldings().filter(h => h.assetClass === assetClass);
}

// ── Derived maps (unchanged signatures) ──────────────────────────────────────

export function getCryptoIds() {
  const ids = {};
  for (const h of getHoldingsByAssetClass('crypto')) {
    if (h.ticker && h.coingeckoId) ids[h.ticker] = h.coingeckoId;
  }
  return ids;
}

export function getLiveStockSymbols() {
  const symbols = {};
  for (const h of [...getHoldingsByAssetClass('stock'), ...getHoldingsByAssetClass('etf')]) {
    if (h.ticker && h.avSymbol != null) symbols[h.ticker] = h.avSymbol;
  }
  return symbols;
}

export function getAllStockTickers() {
  return [...getHoldingsByAssetClass('stock'), ...getHoldingsByAssetClass('etf')]
    .map(h => h.ticker).filter(Boolean);
}

export function getTickerKeywords() {
  const keywords = {};
  for (const h of getAllHoldings()) {
    if (!h.ticker) continue;
    const tokens = new Set([
      h.ticker.toLowerCase(),
      ...h.name.toLowerCase().split(/[\s\-\/]+/).filter(w => w.length > 2),
    ]);
    keywords[h.ticker] = [...tokens];
  }
  return keywords;
}

export function buildHoldingsUniverse() {
  const all = getAllHoldings();
  if (all.length === 0) return '  (no holdings configured)';
  const GROUP_LABELS = { stock:'Stocks', etf:'ETFs', fund:'Funds', crypto:'Crypto',
    bond:'Bonds', reit:'REITs', commodity:'Commodities', warrant:'Warrants',
    certificate:'Certificates', other:'Other' };
  const ORDER = ['stock','etf','fund','crypto','bond','reit','commodity','warrant','certificate','other'];
  const groups = {};
  for (const h of all) { const k = h.assetClass ?? 'other'; (groups[k] = groups[k] ?? []).push(h); }
  const lines = [];
  for (const key of ORDER) {
    const items = groups[key]; if (!items) continue;
    const label = (GROUP_LABELS[key] ?? key) + ':';
    const names = items.map(h => h.name ? `${h.ticker} (${h.name})` : h.ticker).join(', ');
    lines.push(`  ${label.padEnd(15)} ${names}`);
  }
  return lines.join('\n');
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function saveHoldings(data, accountId) {
  const errors = [], warnings = [];
  const allTickers = {};

  for (const platform of PLATFORMS) {
    const entries = data[platform];
    // Omitted (or explicit null) means "don't touch this platform" — falls
    // back to existing on-disk data below, not validated here (it was
    // already valid when it was last saved). An explicit [] is a real,
    // intentional wipe and IS validated (trivially — nothing to check).
    if (entries === undefined || entries === null) continue;
    if (!Array.isArray(entries)) { errors.push(`"${platform}" must be an array`); continue; }
    const seenInPlatform = new Set();
    for (const h of entries) {
      if (!h.ticker) continue;
      if (seenInPlatform.has(h.ticker))
        errors.push(`Duplicate ticker "${h.ticker}" in ${platform} — each holding must be unique per platform`);
      seenInPlatform.add(h.ticker);
    }
    for (const [i, h] of entries.entries()) {
      const ref = `${platform}[${i}]${h.ticker ? ` (${h.ticker})` : ''}`;
      if (!h.ticker)     errors.push(`${ref}: "ticker" is required`);
      if (!h.assetClass) errors.push(`${ref}: "assetClass" is required`);
      else if (!VALID_ASSET_CLASSES.includes(h.assetClass))
        errors.push(`${ref}: assetClass "${h.assetClass}" must be one of: ${VALID_ASSET_CLASSES.join(', ')}`);

      const lots = Array.isArray(h.lots) ? h.lots : [];
      if (lots.length === 0) {
        errors.push(`${ref}: at least one purchase lot is required`);
      } else {
        const currencies = new Set();
        lots.forEach((lot, li) => {
          const lotRef = `${ref} lot ${li + 1}`;
          const units = Number(lot.units), totalCost = Number(lot.totalCost);
          if (!(units > 0))      errors.push(`${lotRef}: units must be greater than 0`);
          if (!(totalCost >= 0)) errors.push(`${lotRef}: totalCost cannot be negative`);
          if (!lot.currency)     errors.push(`${lotRef}: currency is required`);
          else currencies.add(lot.currency);
          if (!isValidPurchaseDate(lot.purchaseDate))
            errors.push(`${lotRef}: purchaseDate must be a valid date in YYYY-MM-DD format`);
          else if (lot.purchaseDate > todayIsoDate())
            errors.push(`${lotRef}: purchaseDate cannot be in the future`);
        });
        if (currencies.size > 1)
          errors.push(`${ref}: all lots must use the same currency (found ${[...currencies].join(', ')})`);
        if (errors.length === 0) {
          const { units, avgCost } = deriveHoldingTotals(lots);
          if (units > 0 && avgCost === 0)
            warnings.push(`${ref}: total cost is 0 across all lots — cost basis will be missing from tax calculations`);
        }
      }
      if (h.ticker) (allTickers[h.ticker] = allTickers[h.ticker] ?? []).push(platform);
    }
  }

  for (const [ticker, plats] of Object.entries(allTickers)) {
    if (plats.length > 1)
      warnings.push(`"${ticker}" appears in multiple platforms (${plats.join(', ')}) — is this intentional?`);
  }

  if (errors.length > 0) return { success: false, errors, warnings };

  const enrich = (h) => {
    // units/avgCost/currency/purchaseDate are derived — never persisted at rest.
    // Strip them if present (e.g. leftover from the pre-lots schema) and store
    // only the normalized lots array.
    const { units, avgCost, currency, purchaseDate, ...rest } = h;
    const out = { ...rest };
    out.lots = (Array.isArray(h.lots) ? h.lots : []).map((lot) => ({
      units:        Number(lot.units),
      totalCost:    Number(lot.totalCost),
      currency:     lot.currency,
      purchaseDate: lot.purchaseDate,
    }));
    if (out.assetClass === 'crypto' && !out.coingeckoId) {
      const mapped = KNOWN_COINGECKO_IDS[out.ticker?.toUpperCase()];
      out.coingeckoId = mapped ?? out.ticker?.toLowerCase() ?? '';
      if (!mapped && out.ticker)
        warnings.push(`coingeckoId for ${out.ticker} was auto-derived as "${out.coingeckoId}" — verify at coingecko.com if prices don't appear`);
    }
    if ((out.assetClass === 'stock' || out.assetClass === 'etf') && !out.avSymbol)
      out.avSymbol = out.ticker?.toUpperCase() ?? null;
    return out;
  };

  const id = accountId ?? getActiveAccountId();
  const filePath = accountFilePath(id);
  // Read existing on-disk data once — the fallback source for any platform
  // key the caller omitted. Only used as-is (never re-enriched): re-running
  // enrich() on already-on-disk data would strip a still-legacy holding's
  // flat fields and leave it with lots: [] instead of preserving it.
  const existing = readHoldingsFile(filePath);

  const toSave = {
    displayCurrency: data.displayCurrency ?? 'EUR',
    nordnet: (data.nordnet !== undefined && data.nordnet !== null) ? data.nordnet.map(enrich) : existing.nordnet,
    nordea:  (data.nordea  !== undefined && data.nordea  !== null) ? data.nordea.map(enrich)  : existing.nordea,
    kvarnx:  (data.kvarnx  !== undefined && data.kvarnx  !== null) ? data.kvarnx.map(enrich)  : existing.kvarnx,
    lastUpdated: new Date().toISOString(),
  };

  try {
    if (!existsSync(ACCOUNTS_DIR)) mkdirSync(ACCOUNTS_DIR, { recursive: true });
    writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf-8');

    // Update index metadata
    const index = readAccountsIndex();
    const entry = index.accounts.find(a => a.id === id);
    if (entry) {
      const meta = computeIndexMetadata(toSave);
      entry.holdingCount = meta.holdingCount;
      entry.platforms    = meta.platforms;
      entry.lastUpdated  = toSave.lastUpdated;
      writeAccountsIndex(index);
    }

    return { success: true, errors: [], warnings };
  } catch (err) {
    return { success: false, errors: [`Failed to write holdings file: ${err.message}`], warnings };
  }
}

// ── Tracked assets (per-account, stored in account file) ─────────────────────

export function getTrackedAssets(accountId) {
  if (isDemoMode()) return [];
  const filePath = accountFilePath(accountId ?? getActiveAccountId());
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8').replace(/^﻿/, ''));
    return Array.isArray(raw.trackedAssets) ? raw.trackedAssets : [];
  } catch { return []; }
}

export function saveTrackedAssets(tickers, accountId) {
  const id = accountId ?? getActiveAccountId();
  const filePath = accountFilePath(id);
  const existing = existsSync(filePath)
    ? (() => { try { return JSON.parse(readFileSync(filePath, 'utf-8').replace(/^﻿/, '')); } catch { return {}; } })()
    : { ...structuredClone(EMPTY_HOLDINGS), lastUpdated: new Date().toISOString() };
  const cleaned = [...new Set(
    (Array.isArray(tickers) ? tickers : [])
      .map(t => String(t).trim().toUpperCase())
      .filter(t => t.length > 0 && t.length <= 12)
  )];
  existing.trackedAssets = cleaned;
  writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
  return cleaned;
}

// ── Account management ────────────────────────────────────────────────────────

export function createAccount(name, description = '', color = '#4CAF50') {
  const index = readAccountsIndex();
  const id = `acc_${Date.now()}`;
  const now = new Date().toISOString();
  const account = {
    id, name: String(name).trim().slice(0, 30),
    description: String(description ?? '').trim().slice(0, 100),
    createdAt: now, lastUpdated: now,
    color: color ?? '#4CAF50', holdingCount: 0, platforms: [],
  };
  writeFileSync(accountFilePath(id), JSON.stringify({ ...structuredClone(EMPTY_HOLDINGS), lastUpdated: now }, null, 2), 'utf-8');
  index.accounts.push(account);
  writeAccountsIndex(index);
  return account;
}

export function deleteAccount(accountId) {
  const index = readAccountsIndex();
  if (index.accounts.length <= 1)
    return { success: false, error: 'Cannot delete the last remaining account — create another account first' };

  const targetIdx = index.accounts.findIndex(a => a.id === accountId);
  if (targetIdx === -1) return { success: false, error: `Account "${accountId}" not found` };

  const activeId = getActiveAccountId();
  let newActiveId = activeId;
  if (activeId === accountId) {
    newActiveId = index.accounts.find(a => a.id !== accountId).id;
    writeFileSync(ACTIVE_ACCOUNT_FILE, JSON.stringify({ activeAccountId: newActiveId, setAt: new Date().toISOString() }, null, 2), 'utf-8');
  }

  index.accounts.splice(targetIdx, 1);
  writeAccountsIndex(index);

  const fp = accountFilePath(accountId);
  if (existsSync(fp)) try { unlinkSync(fp); } catch {}

  const result = { success: true, newActiveId };
  if (accountId === 'acc_1' && existsSync(MIGRATION_LOG))
    result.warning = 'This was your original migrated account — user-holdings.backup.json still exists if you need to recover data';

  return result;
}

export function switchAccount(accountId) {
  const index = readAccountsIndex();
  const account = index.accounts.find(a => a.id === accountId);
  if (!account) return { success: false, error: `Account "${accountId}" not found` };
  writeFileSync(ACTIVE_ACCOUNT_FILE, JSON.stringify({ activeAccountId: accountId, setAt: new Date().toISOString() }, null, 2), 'utf-8');
  return { success: true, account };
}

export function renameAccount(accountId, name, description, color) {
  const index = readAccountsIndex();
  const entry = index.accounts.find(a => a.id === accountId);
  if (!entry) return { success: false, error: `Account "${accountId}" not found` };
  if (name        !== undefined) entry.name        = String(name).trim().slice(0, 30);
  if (description !== undefined) entry.description = String(description).trim().slice(0, 100);
  if (color       !== undefined) entry.color       = color;
  writeAccountsIndex(index);
  return { success: true, account: entry };
}
