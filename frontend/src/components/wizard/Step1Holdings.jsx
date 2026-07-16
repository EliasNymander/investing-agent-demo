import React, { useState, useRef, useEffect } from 'react';

const ASSET_CLASSES = [
  { value: 'stock',       label: 'Stock' },
  { value: 'etf',         label: 'ETF' },
  { value: 'fund',        label: 'Fund' },
  { value: 'crypto',      label: 'Crypto' },
  { value: 'bond',        label: 'Bond' },
  { value: 'reit',        label: 'REIT' },
  { value: 'commodity',   label: 'Commodity' },
  { value: 'warrant',     label: 'Warrant' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other',       label: 'Other' },
];

const CURRENCIES = ['EUR', 'USD', 'SEK', 'GBP', 'NOK', 'DKK'];

// Keep in sync with backend/config/holdings.js KNOWN_COINGECKO_IDS
const KNOWN_COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', LINK: 'chainlink',
  BNB: 'binancecoin', ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2',
  MATIC: 'matic-network', UNI: 'uniswap', ATOM: 'cosmos', XRP: 'ripple',
  LTC: 'litecoin', DOGE: 'dogecoin', SHIB: 'shiba-inu', FTM: 'fantom',
  NEAR: 'near', APT: 'aptos', OP: 'optimism', ARB: 'arbitrum',
};

// ISIN → internal ticker for CSV import
const ISIN_TO_TICKER = {
  'IE00B4L5Y983': 'IWDA',
  'NL0010273215': 'ASML',
  'IE00BK5BQT80': 'VWCE',
  'DK0062498333': 'NOVO-B',
  'GB00BP6MXD84': 'SHEL',
  'SE0000115446': 'VOLV-B',
  'FI4000999001': 'NORDEA-STABLE',
  'FI4000999002': 'NORDEA-NORDIC-SC',
};

const ASSET_LABELS = {
  stock:       n => `${n} stock${n !== 1 ? 's' : ''}`,
  etf:         n => `${n} ETF${n !== 1 ? 's' : ''}`,
  fund:        n => `${n} fund${n !== 1 ? 's' : ''}`,
  crypto:      n => `${n} crypto`,
  bond:        n => `${n} bond${n !== 1 ? 's' : ''}`,
  reit:        n => `${n} REIT${n !== 1 ? 's' : ''}`,
  commodity:   n => `${n} commodit${n !== 1 ? 'ies' : 'y'}`,
  warrant:     n => `${n} warrant${n !== 1 ? 's' : ''}`,
  certificate: n => `${n} certificate${n !== 1 ? 's' : ''}`,
  other:       n => `${n} other`,
};

function currencyFromIsin(isin) {
  const p = (isin || '').toUpperCase().trim().slice(0, 2);
  if (p === 'SE') return 'SEK';
  if (p === 'NO') return 'NOK';
  if (p === 'DK') return 'DKK';
  if (p === 'GB') return 'GBP';
  if (['IE', 'FI', 'LU', 'DE', 'FR', 'NL', 'AT', 'BE'].includes(p)) return 'EUR';
  return null;
}

function defaultCurrencyForAsset(assetClass) {
  if (assetClass === 'crypto' || assetClass === 'reit') return 'USD';
  if (assetClass === 'fund' || assetClass === 'etf') return 'EUR';
  return 'USD';
}

function makeLot({ units = '', totalCost = '', currency, purchaseDate = '' } = {}) {
  return { units, totalCost, currency, purchaseDate };
}
function emptyLot(currency) {
  return makeLot({ currency });
}

// Canonical holding shape for CSV-imported rows (positions + transactions
// parsers) — matches emptyHolding()'s field set exactly, built through one
// function so the two importers can't drift from each other or from manual
// entry.
function makeImportedHolding({ ticker, name, currency, assetClass, isin, lots }) {
  return {
    ticker, name, currency, assetClass, isin,
    coingeckoId: '',
    avSymbol: assetClass === 'stock' || assetClass === 'etf' ? ticker : '',
    lots,
  };
}

function emptyHolding(defaultAssetClass) {
  const currency = defaultCurrencyForAsset(defaultAssetClass);
  return {
    ticker: '',
    name: '',
    currency,
    assetClass: defaultAssetClass,
    isin: '',
    coingeckoId: '',
    avSymbol: '',
    lots: [emptyLot(currency)],
  };
}

// Legacy (pre-lots) holdings have no `lots[]` yet — seed one lot from the old
// flat units/avgCost/purchaseDate so the row isn't blank. Also exported and
// used by SetupWizard.jsx to normalize holdings into real `lots[]` right when
// they're loaded, so a row that looks like it has a purchase always actually
// has one in state (previously this only ran as a display fallback here,
// so an untouched legacy row would pass visual inspection but still fail
// save-time "at least one purchase lot is required" validation).
export function ensureLots(h) {
  if (Array.isArray(h.lots) && h.lots.length > 0) return h.lots;
  const units = Number(h.units) || 0;
  const avgCost = Number(h.avgCost) || 0;
  return [{
    units: h.units ?? '',
    totalCost: units > 0 && avgCost > 0 ? String(units * avgCost) : '',
    currency: h.currency ?? 'EUR',
    purchaseDate: h.purchaseDate || '',
  }];
}

// Mirrors backend/config/holdings.js deriveHoldingTotals() for a live preview.
// No rounding in the math — only formatPrecise() below rounds, for display.
function deriveLotTotals(lots) {
  const totalUnits = lots.reduce((s, l) => s + (Number(l.units) || 0), 0);
  const totalCost  = lots.reduce((s, l) => s + (Number(l.totalCost) || 0), 0);
  const avgCost    = totalUnits > 0 ? totalCost / totalUnits : 0;
  return { totalUnits, totalCost, avgCost };
}

// Display-only — never affects the actual values in state or the payload.
// Keeps at least 4 decimals (real holdings use up to 165.6054) without
// printing raw floating-point noise.
function formatPrecise(n, minDp = 4, maxDp = 8) {
  if (!Number.isFinite(n)) return '—';
  const trimmed = n.toFixed(maxDp).replace(/0+$/, '').replace(/\.$/, '');
  const dp = Math.max(minDp, (trimmed.split('.')[1] || '').length);
  return n.toFixed(dp);
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showIsin(assetClass) {
  return assetClass === 'fund' || assetClass === 'etf';
}

function detectAssetClass(isin) {
  if (!isin) return 'stock';
  const p = isin.toUpperCase().slice(0, 2);
  if (p === 'FI' || p === 'SE') return 'fund';
  if (p === 'IE' || p === 'LU') return 'etf';
  return 'stock';
}

// Parse a Nordnet CSV/TSV portfolio export.
// Handles: UTF-8 BOM, semicolon/tab delimiter, Swedish/Finnish/English column names.
// Produces a single lot per row with totalCost = acquisitionValue as-is (no
// division, no rounding) — Nordnet's export has no per-transaction breakdown
// or purchase date, so this is one blended lot, same limitation as before.
function parseNordnetCsv(text) {
  const raw = text.replace(/^﻿/, '').trim();
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'File appears empty or has only one row.', rows: [] };

  const delim = lines[0].includes('\t') ? '\t' : ';';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const col = (...candidates) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h === c || h.startsWith(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iCol     = col('isin');
  const nameCol  = col('instrument', 'värdepapper', 'instrumentnamn', 'instrumentti', 'name');
  const unitsCol = col('antal', 'quantity', 'units', 'amount', 'määrä');
  const currCol  = col('valuta', 'currency', 'valuutta');
  const acqCol   = col('anskaffningsvärde', 'acquisition value', 'purchase value', 'inköpsvärde', 'hankintahinta');

  if (unitsCol === -1 && iCol === -1) {
    return {
      error: 'Could not find required columns. Export from Nordnet → Portfolio → Download as CSV.',
      rows: [],
    };
  }

  // Nordnet uses space/non-breaking-space as thousands sep and comma as decimal sep in Swedish exports
  const parseNum = (s) => {
    if (!s) return 0;
    const cleaned = String(s).replace(/[\s ]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue;

    const isin     = iCol     !== -1 ? cells[iCol].toUpperCase()    : '';
    const name     = nameCol  !== -1 ? cells[nameCol]               : '';
    const units    = unitsCol !== -1 ? parseNum(cells[unitsCol])    : 0;
    const currency = currCol  !== -1 ? cells[currCol].toUpperCase() : 'EUR';
    const acqVal   = acqCol   !== -1 ? parseNum(cells[acqCol])      : 0;

    const ticker     = ISIN_TO_TICKER[isin] || (isin || name.slice(0, 12).toUpperCase().replace(/\s+/g, '-') || `ROW${i}`);
    const assetClass = detectAssetClass(isin);
    const fromIsin   = currencyFromIsin(isin);
    const rowCurrency = fromIsin || currency || 'EUR';

    rows.push(makeImportedHolding({
      ticker, name, currency: rowCurrency, assetClass, isin,
      lots: units > 0
        ? [makeLot({ units: String(units), totalCost: acqVal > 0 ? String(acqVal) : '', currency: rowCurrency, purchaseDate: '' })]
        : [],
    }));
  }

  if (rows.length === 0) return { error: 'No data rows found after the header line.', rows: [] };
  return { error: null, rows };
}

function isBuyType(type) {
  return type.trim().toLowerCase().startsWith('osto');
}
function isSellType(type) {
  const t = type.trim().toLowerCase();
  return t === 'myynti' || t.includes('vaihto myy');
}

const NET_UNITS_EPSILON = 1e-6;

// Parses a Nordnet *transactions* export (one row per buy/sell) into one lot
// per buy transaction, grouped by ISIN. Sells net out units per ISIN; a
// fully sold-out position (net ≈ 0) is excluded entirely. Partial sells are
// NOT lot-matched (no FIFO) — all buy lots are imported as-is and flagged in
// `issues`. Mixed-currency holdings are routed to `needsReview` (not silently
// dropped, not blended) since saveHoldings() would reject them anyway and a
// buried issue string is too easy to miss with hundreds of transactions.
// Caller decodes UTF-16 → text first (Phase 2) — this takes plain decoded
// text, same contract as parseNordnetCsv.
function parseNordnetTransactionsCsv(text) {
  const raw = text.replace(/^﻿/, '').trim();
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return { error: 'File appears empty or has only one row.', rows: [], excluded: [], issues: [], needsReview: [] };
  }

  const delim = lines[0].includes('\t') ? '\t' : ';';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const col = (...candidates) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h === c || h.startsWith(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateCol  = col('kauppapäivä');
  const typeCol  = col('tapahtumatyyppi');
  const nameCol  = col('arvopaperi');
  const isinCol  = col('isin');
  const unitsCol = col('määrä');
  const costCol  = col('hankinta-arvo');
  // Nordnet's transactions export repeats "Valuutta" once per monetary
  // column (fees, Summa, Hankinta-arvo, Tulos, Välityspalkkio each get their
  // own currency column immediately after them) — a bare col('valuutta')
  // grabs the FIRST one (fees, always EUR), not the one that actually prices
  // Hankinta-arvo. Real securities trade in DKK (NOVO-B)
  // and SEK (VOLV-B), so that mistake would silently write
  // the wrong currency onto the lot while totalCost stayed in the original
  // currency. Resolve by adjacency to Hankinta-arvo instead; fall back to
  // the bare match only if the expected pairing isn't where expected.
  const currCol = (costCol !== -1 && headers[costCol + 1] === 'valuutta') ? costCol + 1 : col('valuutta');

  if (typeCol === -1 || isinCol === -1 || unitsCol === -1) {
    return {
      error: 'Could not find required columns (Tapahtumatyyppi/ISIN/Määrä). Export from Nordnet → Transactions → Download.',
      rows: [], excluded: [], issues: [], needsReview: [],
    };
  }

  const parseNum = (s) => {
    if (!s) return 0;
    const cleaned = String(s).replace(/[\s ]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // isin -> { name, buyLots: [], buyUnits, sellUnits, currencies: Set }
  const groups = new Map();
  let unrecognizedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue;

    const isin = isinCol !== -1 ? cells[isinCol].toUpperCase() : '';
    if (!isin) continue;

    const type     = typeCol  !== -1 ? cells[typeCol]  : '';
    const name     = nameCol  !== -1 ? cells[nameCol]  : '';
    const units    = unitsCol !== -1 ? parseNum(cells[unitsCol]) : 0;
    const cost     = costCol  !== -1 ? parseNum(cells[costCol])  : 0;
    const currency = currCol  !== -1 ? cells[currCol].toUpperCase() : 'EUR';
    const date     = dateCol  !== -1 ? cells[dateCol]  : '';

    if (!groups.has(isin)) groups.set(isin, { name, buyLots: [], buyUnits: 0, sellUnits: 0, currencies: new Set() });
    const g = groups.get(isin);
    if (name && !g.name) g.name = name;

    if (isBuyType(type)) {
      g.buyLots.push(makeLot({ units: String(units), totalCost: String(cost), currency, purchaseDate: date }));
      g.buyUnits += units;
      g.currencies.add(currency);
    } else if (isSellType(type)) {
      g.sellUnits += units;
    } else {
      unrecognizedCount++;
    }
  }

  const rows = [];
  const excluded = [];
  const issues = [];
  const needsReview = [];

  for (const [isin, g] of groups.entries()) {
    const netUnits = g.buyUnits - g.sellUnits;
    if (Math.abs(netUnits) < NET_UNITS_EPSILON) { excluded.push({ isin, name: g.name }); continue; }
    if (g.buyLots.length === 0) continue; // sell-only rows with no matching buy in this export

    const ticker = ISIN_TO_TICKER[isin] || isin;
    const assetClass = detectAssetClass(isin);

    if (g.currencies.size > 1) {
      needsReview.push({
        ticker, isin, name: g.name,
        currencies: [...g.currencies],
        reason: `lots span multiple currencies (${[...g.currencies].join(', ')}) — not imported, needs manual review`,
      });
      continue;
    }
    if (g.sellUnits > NET_UNITS_EPSILON) {
      issues.push(`${ticker}: ${g.sellUnits} unit(s) sold but position not fully closed — all buy lots imported as-is, sold units are not excluded (no FIFO lot-matching)`);
    }

    rows.push(makeImportedHolding({ ticker, name: g.name, currency: [...g.currencies][0], assetClass, isin, lots: g.buyLots }));
  }

  if (unrecognizedCount > 0) {
    issues.push(`${unrecognizedCount} transaction row(s) had an unrecognized type and were ignored (not buy or sell)`);
  }
  if (rows.length === 0 && excluded.length === 0 && needsReview.length === 0) {
    return { error: 'No buy/sell transactions found after the header line.', rows: [], excluded: [], issues: [], needsReview: [] };
  }
  return { error: null, rows, excluded, issues, needsReview };
}

function getHints(h, avgCost) {
  const hints = [];
  if (h.assetClass === 'crypto' && h.ticker && h.ticker.length > 5) {
    hints.push({ type: 'warn', msg: 'Crypto tickers are usually 3–5 characters (BTC, ETH, LINK)' });
  }
  if (showIsin(h.assetClass) && !h.isin) {
    hints.push({ type: 'info', msg: 'Adding an ISIN helps with price lookups and tax reporting' });
  }
  if ((h.currency === 'SEK' || h.currency === 'NOK') && avgCost > 10000) {
    hints.push({ type: 'info', msg: `Looks high for a ${h.currency} price — double-check your lot totals` });
  }
  return hints;
}

function HoldingRows({ items, onChange, defaultAssetClass }) {
  const [advanced, setAdvanced] = useState({});
  const [undoItem, setUndoItem] = useState(null); // { index, holding }
  const undoTimerRef = useRef(null);

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  const toggleAdvanced = (i) => setAdvanced(prev => ({ ...prev, [i]: !prev[i] }));

  const add = () => onChange([...items, emptyHolding(defaultAssetClass)]);

  const remove = (i) => {
    const holding = items[i];
    onChange(items.filter((_, idx) => idx !== i));
    setAdvanced(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k);
        if (ki === i) continue;
        next[ki < i ? ki : ki - 1] = v;
      }
      return next;
    });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoItem({ index: i, holding });
    undoTimerRef.current = setTimeout(() => setUndoItem(null), 5000);
  };

  const undoRemove = () => {
    if (!undoItem) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const next = [...items];
    next.splice(undoItem.index, 0, undoItem.holding);
    onChange(next);
    setUndoItem(null);
  };

  const update = (i, field, value) => {
    const next = [...items];
    const prev = next[i];
    const updated = { ...prev, [field]: value };

    if (field === 'assetClass') {
      const fromIsin = showIsin(value) ? currencyFromIsin(updated.isin) : null;
      updated.currency = fromIsin ?? defaultCurrencyForAsset(value);
      if (value === 'crypto' && !updated.coingeckoId) {
        updated.coingeckoId = KNOWN_COINGECKO_IDS[updated.ticker] ?? '';
      }
    }

    if (field === 'ticker') {
      const upper = value.toUpperCase();
      if (updated.assetClass === 'crypto') {
        updated.coingeckoId = KNOWN_COINGECKO_IDS[upper] ?? '';
      }
      if (updated.assetClass === 'stock' || updated.assetClass === 'etf') {
        if (!prev.avSymbol || prev.avSymbol === prev.ticker) {
          updated.avSymbol = upper;
        }
      }
    }

    if (field === 'isin' && showIsin(updated.assetClass)) {
      const fromIsin = currencyFromIsin(value);
      if (fromIsin) updated.currency = fromIsin;
    }

    // Currency is one-per-holding — keep every lot in sync however it changed
    // (direct edit, asset-class default, or ISIN inference). This is also the
    // point where a legacy (lots-less) holding gets its lots seeded, since
    // changing currency counts as editing this holding.
    if (updated.currency !== prev.currency) {
      updated.lots = ensureLots(updated).map((lot) => ({ ...lot, currency: updated.currency }));
    }

    next[i] = updated;
    onChange(next);
  };

  const updateLot = (i, li, field, value) => {
    const next = [...items];
    const lots = ensureLots(next[i]).map((lot, idx) => idx === li ? { ...lot, [field]: value } : lot);
    next[i] = { ...next[i], lots };
    onChange(next);
  };

  const addLot = (i) => {
    const next = [...items];
    const holding = next[i];
    next[i] = { ...holding, lots: [...ensureLots(holding), emptyLot(holding.currency)] };
    onChange(next);
  };

  const removeLot = (i, li) => {
    const next = [...items];
    const lots = ensureLots(next[i]);
    if (lots.length <= 1) return; // minimum one lot, mirrors backend validation
    next[i] = { ...next[i], lots: lots.filter((_, idx) => idx !== li) };
    onChange(next);
  };

  return (
    <>
      {items.length > 5 && (
        <button className="wizard-add-btn" onClick={add} style={{ marginBottom: 8 }}>
          + Add position
        </button>
      )}
      {undoItem && (
        <div className="wizard-undo-bar">
          <span>Removed <strong>{undoItem.holding.ticker || 'row'}</strong></span>
          <button className="wizard-undo-btn" onClick={undoRemove}>Undo</button>
        </div>
      )}
      {items.map((h, i) => {
        const lots = ensureLots(h);
        const { totalUnits, avgCost } = deriveLotTotals(lots);
        const hints      = getHints(h, avgCost);
        const isStockEtf = h.assetClass === 'stock' || h.assetClass === 'etf';
        const isCrypto   = h.assetClass === 'crypto';
        const stableKey  = `${defaultAssetClass}-${h.ticker || i}-${i}`;

        return (
          <div key={stableKey} className="wizard-holding-group">
            {/* Row 1: ticker | name | type | currency | × */}
            <div className="wizard-holding-row1">
              <input
                className="wizard-input"
                placeholder="ASML"
                value={h.ticker}
                onChange={(e) => update(i, 'ticker', e.target.value.toUpperCase())}
              />
              <input
                className="wizard-input"
                placeholder="Name"
                title="Used for news tagging and AI context — fill in for better results"
                value={h.name}
                onChange={(e) => update(i, 'name', e.target.value)}
              />
              <select
                className="wizard-select"
                value={h.assetClass}
                onChange={(e) => update(i, 'assetClass', e.target.value)}
              >
                {ASSET_CLASSES.map(ac => (
                  <option key={ac.value} value={ac.value}>{ac.label}</option>
                ))}
              </select>
              <select
                className="wizard-select"
                value={h.currency}
                onChange={(e) => update(i, 'currency', e.target.value)}
                title="Currency for this holding"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="wizard-rm-btn" onClick={() => remove(i)}>×</button>
            </div>

            {/* Lots: one row per real purchase */}
            <div className="wizard-lots-block">
              <div className="wizard-lots-header">
                <span className="wizard-field-label">Purchases</span>
                <span className="wizard-lots-derived">
                  {formatPrecise(totalUnits)} units · avg cost {formatPrecise(avgCost)} {h.currency}
                </span>
              </div>
              {lots.map((lot, li) => {
                const lotUnits = Number(lot.units) || 0;
                const lotCost  = Number(lot.totalCost) || 0;
                const perUnit  = lotUnits > 0 ? lotCost / lotUnits : null;
                return (
                  <div className="wizard-lot-row" key={li}>
                    <div className="wizard-field-group">
                      <span className="wizard-field-label">Units</span>
                      <input
                        className="wizard-input"
                        placeholder="0.0000"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={lot.units}
                        onChange={(e) => updateLot(i, li, 'units', e.target.value)}
                        title="Units bought in this purchase"
                      />
                    </div>
                    <div className="wizard-field-group">
                      <span className="wizard-field-label">Total Paid ({h.currency})</span>
                      <input
                        className="wizard-input"
                        placeholder="0.00"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={lot.totalCost}
                        onChange={(e) => updateLot(i, li, 'totalCost', e.target.value)}
                        title="Total amount paid for this purchase — not a per-unit price"
                      />
                      {perUnit != null && (
                        <span className="wizard-field-hint">{formatPrecise(perUnit)} / unit</span>
                      )}
                    </div>
                    <div className="wizard-field-group">
                      <span className="wizard-field-label">Purchase Date</span>
                      <input
                        className="wizard-input"
                        type="date"
                        max={todayIsoLocal()}
                        value={lot.purchaseDate || ''}
                        onChange={(e) => updateLot(i, li, 'purchaseDate', e.target.value)}
                        title="When this purchase happened"
                      />
                    </div>
                    <button
                      className="wizard-rm-btn"
                      onClick={() => removeLot(i, li)}
                      disabled={lots.length <= 1}
                      title={lots.length <= 1 ? 'At least one purchase is required' : 'Remove this purchase'}
                      type="button"
                    >×</button>
                  </div>
                );
              })}
              <button className="wizard-add-lot-btn" onClick={() => addLot(i)} type="button">
                + Add purchase
              </button>
            </div>

            {/* Row 3a: ISIN (fund / etf) */}
            {showIsin(h.assetClass) && (
              <div className="wizard-holding-row3">
                <input
                  className="wizard-input"
                  placeholder="ISIN (optional, e.g. IE00BQN1K562)"
                  value={h.isin || ''}
                  onChange={(e) => update(i, 'isin', e.target.value.toUpperCase())}
                />
              </div>
            )}

            {/* Row 3b: CoinGecko ID (crypto) */}
            {isCrypto && (
              <div className="wizard-holding-row3">
                <div className="wizard-field-group">
                  <span className="wizard-field-label">CoinGecko ID</span>
                  <input
                    className="wizard-input"
                    placeholder="auto-detected"
                    value={h.coingeckoId || ''}
                    onChange={(e) => update(i, 'coingeckoId', e.target.value.toLowerCase())}
                  />
                  <span className="wizard-field-hint">
                    Leave blank to auto-detect, or find the correct ID at coingecko.com
                  </span>
                </div>
              </div>
            )}

            {/* Advanced toggle + AV Symbol (stock / etf) */}
            {isStockEtf && (
              <button
                className="wizard-advanced-toggle"
                onClick={() => toggleAdvanced(i)}
                type="button"
              >
                Advanced {advanced[i] ? '▲' : '▼'}
              </button>
            )}
            {isStockEtf && advanced[i] && (
              <div className="wizard-holding-row3">
                <div className="wizard-field-group">
                  <span className="wizard-field-label">AV Symbol</span>
                  <input
                    className="wizard-input"
                    placeholder={h.ticker || 'same as ticker'}
                    value={h.avSymbol || ''}
                    onChange={(e) => update(i, 'avSymbol', e.target.value.toUpperCase())}
                  />
                  <span className="wizard-field-hint">
                    Leave blank to use ticker. For European stocks add exchange suffix e.g. IWDA.LON
                  </span>
                </div>
              </div>
            )}

            {/* Validation hints */}
            {hints.map((hint, hi) => (
              <div key={hi} className={`wizard-holding-hint wizard-holding-hint--${hint.type}`}>
                {hint.type === 'warn' ? '⚠ ' : 'ℹ '}{hint.msg}
              </div>
            ))}
          </div>
        );
      })}
      <button className="wizard-add-btn" onClick={add}>+ Add position</button>
    </>
  );
}

// Detects UTF-16 (BOM FF FE / FE FF) vs UTF-8/ASCII and decodes accordingly.
// The positions export is UTF-8; the transactions export is UTF-16LE with a
// BOM — reading that as UTF-8 text produces null-byte-interleaved garbage, so
// encoding must be sniffed from the raw bytes before any string parsing runs.
// Must run before format detection, since the header can't be read correctly
// out of a wrongly-decoded buffer.
function decodeCsvBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(buffer);
  return new TextDecoder('utf-8').decode(buffer);
}

// The transactions export has a Tapahtumatyyppi (transaction type) column
// the positions export never has — the one deterministic signal to route to
// the right parser. Runs on already-decoded text.
function isTransactionsFormat(text) {
  const firstLine = (text.split(/\r?\n/, 1)[0] || '').replace(/^﻿/, '');
  const delim = firstLine.includes('\t') ? '\t' : ';';
  const headers = firstLine.split(delim).map(h => h.trim().toLowerCase());
  return headers.some(h => h.includes('tapahtumatyyppi'));
}

export default function Step1Holdings({ holdings, onChange }) {
  const [csvPreview, setCsvPreview] = useState(null); // { error, rows, excluded, issues, needsReview } | null
  const [expandedRows, setExpandedRows] = useState({});
  const csvInputRef = useRef(null);

  const update = (platform, value) => onChange({ ...holdings, [platform]: value });

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Bytes → decode → detect format → parse, in that order — format
      // detection reads the header, which only makes sense once the bytes
      // have been decoded with the right encoding.
      const text = decodeCsvBuffer(ev.target.result);
      const result = isTransactionsFormat(text)
        ? parseNordnetTransactionsCsv(text)
        : parseNordnetCsv(text);
      setExpandedRows({});
      setCsvPreview({
        error: result.error,
        rows: result.rows || [],
        excluded: result.excluded || [],
        issues: result.issues || [],
        needsReview: result.needsReview || [],
      });
    };
    reader.readAsArrayBuffer(file);
  };

  // Fields the importer itself never sets (e.g. a hand-written `note`) would
  // otherwise vanish on Apply, since csvPreview.rows only carries what the
  // parser produces. Carry them forward from the matching existing holding
  // (by resolved ticker, same as ISIN_TO_TICKER everywhere else) so the
  // import only touches lots/units/cost/currency/isin/etc, not custom
  // fields nothing else in the pipeline knows about.
  // NEVER_CARRY also includes units/avgCost/purchaseDate — a pre-lots legacy
  // holding stores these as real top-level keys (not "extra" fields), and
  // they're superseded by lots, not orphaned data. Carrying them forward
  // would put stale values back on an object that already has a `lots`
  // array computing the real ones — backend saveHoldings() strips them
  // again before persisting, but the merge shouldn't produce them in the
  // first place.
  const NEVER_CARRY_FIELDS = new Set([
    'ticker', 'name', 'currency', 'assetClass', 'isin', 'coingeckoId', 'avSymbol', 'lots',
    'units', 'avgCost', 'purchaseDate',
  ]);

  const applyCsvImport = () => {
    if (!csvPreview?.rows?.length) return;
    const existingByTicker = new Map((holdings.nordnet || []).map(h => [h.ticker, h]));
    const merged = csvPreview.rows.map((imported) => {
      const existing = existingByTicker.get(imported.ticker);
      if (!existing) return imported; // genuinely new ticker — nothing to carry
      const carried = {};
      for (const [key, value] of Object.entries(existing)) {
        if (!NEVER_CARRY_FIELDS.has(key)) carried[key] = value;
      }
      return { ...carried, ...imported }; // imported fields always win on overlap
    });
    onChange({ ...holdings, nordnet: merged });
    setCsvPreview(null);
    setExpandedRows({});
  };

  const cancelCsvImport = () => {
    setCsvPreview(null);
    setExpandedRows({});
  };

  const all = [
    ...(holdings.nordnet || []),
    ...(holdings.nordea  || []),
    ...(holdings.kvarnx  || []),
  ].filter(h => h.ticker);

  const counts = {};
  for (const h of all) counts[h.assetClass] = (counts[h.assetClass] || 0) + 1;

  const activePlatforms = ['nordnet', 'nordea', 'kvarnx']
    .filter(p => (holdings[p] || []).some(h => h.ticker)).length;

  const summaryParts = Object.entries(counts)
    .map(([type, n]) => ASSET_LABELS[type]?.(n) ?? `${n} ${type}`)
    .join(' · ');

  return (
    <div>
      <div className="wizard-step-title">Enter Your Holdings</div>
      <div className="wizard-step-desc">
        Add your current positions per platform. Leave empty if you don't use a platform.
        You can update these anytime in Settings.
      </div>

      {/* ── Display currency ── */}
      <div className="wizard-display-currency-row">
        <span className="wizard-field-label" style={{ whiteSpace: 'nowrap' }}>Display Currency</span>
        <select
          className="wizard-select"
          style={{ width: 90 }}
          value={holdings.displayCurrency || 'EUR'}
          onChange={(e) => onChange({ ...holdings, displayCurrency: e.target.value })}
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="wizard-field-hint" style={{ margin: 0 }}>
          All portfolio values are converted to this currency on the dashboard
        </span>
      </div>

      {/* ── Nordnet ── */}
      <div className="wizard-platform-header">
        <span className="wizard-platform-title">Nordnet</span>
        <span className="wizard-platform-subtitle">— Add any holding type</span>
        <button
          className="wizard-import-btn"
          onClick={() => csvInputRef.current?.click()}
          type="button"
        >
          Import from Nordnet CSV
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          style={{ display: 'none' }}
          onChange={handleCsvFile}
        />
      </div>

      {csvPreview && (
        <div className="wizard-csv-preview">
          {csvPreview.error ? (
            <div className="wizard-csv-error">{csvPreview.error}</div>
          ) : (
            <>
              <div className="wizard-csv-preview-title">
                {csvPreview.rows.length} holding{csvPreview.rows.length !== 1 ? 's' : ''} ready to import
                {csvPreview.excluded.length > 0 &&
                  ` · ${csvPreview.excluded.length} excluded (sold out)`}
                {csvPreview.needsReview.length > 0 &&
                  ` · ${csvPreview.needsReview.length} need${csvPreview.needsReview.length === 1 ? 's' : ''} review`}
              </div>

              {/* Mixed-currency holdings — not imported, most severe, shown first */}
              {csvPreview.needsReview.length > 0 && (
                <div className="wizard-csv-section wizard-csv-section--review">
                  <div className="wizard-csv-section-title">
                    ⚠ {csvPreview.needsReview.length} holding{csvPreview.needsReview.length !== 1 ? 's' : ''} not imported — needs manual review
                  </div>
                  <ul className="wizard-csv-section-list">
                    {csvPreview.needsReview.map((item, i) => (
                      <li key={i}><strong>{item.ticker}</strong>{item.name ? ` (${item.name})` : ''} — {item.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fully sold-out positions — correctly excluded, not a problem, but must be visible */}
              {csvPreview.excluded.length > 0 && (
                <div className="wizard-csv-section wizard-csv-section--excluded">
                  <div className="wizard-csv-section-title">
                    {csvPreview.excluded.length} position{csvPreview.excluded.length !== 1 ? 's' : ''} excluded — fully sold out
                  </div>
                  <ul className="wizard-csv-section-list">
                    {csvPreview.excluded.map((item, i) => (
                      <li key={i}><strong>{item.ticker || item.isin}</strong>{item.name ? ` (${item.name})` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Partial-sell / unrecognized-row warnings — informational, doesn't block import */}
              {csvPreview.issues.length > 0 && (
                <div className="wizard-csv-section wizard-csv-section--issues">
                  <div className="wizard-csv-section-title">
                    ⚠ {csvPreview.issues.length} note{csvPreview.issues.length !== 1 ? 's' : ''}
                  </div>
                  <ul className="wizard-csv-section-list">
                    {csvPreview.issues.map((msg, i) => <li key={i}>{msg}</li>)}
                  </ul>
                </div>
              )}

              {csvPreview.rows.length > 0 && (
                <div className="wizard-csv-table-wrap">
                  <table className="wizard-csv-table">
                    <thead>
                      <tr>
                        <th></th><th>Ticker</th><th>Name</th><th>Type</th><th>Lots</th><th>Units</th><th>Total Cost</th><th>Ccy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.rows.map((r, i) => {
                        const { totalUnits, totalCost } = deriveLotTotals(r.lots);
                        const rowIssueMsgs = csvPreview.issues.filter(msg => msg.startsWith(`${r.ticker}:`));
                        const hasBlankCostLot = r.lots.some(l => (Number(l.units) || 0) > 0 && (Number(l.totalCost) || 0) === 0);
                        const flagMsgs = [...rowIssueMsgs, ...(hasBlankCostLot ? ['has a lot with units but no cost — basis will be understated'] : [])];
                        const isExpanded = !!expandedRows[i];
                        return (
                          <React.Fragment key={i}>
                            <tr
                              className="wizard-csv-row wizard-csv-row--clickable"
                              onClick={() => setExpandedRows(prev => ({ ...prev, [i]: !prev[i] }))}
                            >
                              <td className="wizard-csv-caret">{isExpanded ? '▼' : '▶'}</td>
                              <td>
                                {flagMsgs.length > 0 && (
                                  <span className="wizard-csv-flag" title={flagMsgs.join(' · ')}>⚠</span>
                                )}
                                {r.ticker}
                              </td>
                              <td>{r.name || '—'}</td>
                              <td>{r.assetClass}</td>
                              <td>{r.lots.length}</td>
                              <td>{formatPrecise(totalUnits)}</td>
                              <td>{formatPrecise(totalCost, 2, 2)}</td>
                              <td>{r.currency}</td>
                            </tr>
                            {isExpanded && r.lots.map((lot, li) => (
                              <tr className="wizard-csv-lot-row" key={`${i}-${li}`}>
                                <td></td>
                                <td colSpan={2} className="wizard-csv-lot-date">{lot.purchaseDate || '—'}</td>
                                <td></td>
                                <td>{li + 1}</td>
                                <td>{formatPrecise(Number(lot.units) || 0)}</td>
                                <td>{formatPrecise(Number(lot.totalCost) || 0, 2, 2)}</td>
                                <td>{lot.currency}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="wizard-csv-actions">
                <button
                  className="wizard-btn wizard-btn--finish"
                  onClick={applyCsvImport}
                  disabled={csvPreview.rows.length === 0}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  Apply Import
                </button>
                <button
                  className="wizard-btn wizard-btn--back"
                  onClick={cancelCsvImport}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <HoldingRows
        items={holdings.nordnet}
        onChange={(v) => update('nordnet', v)}
        defaultAssetClass="stock"
      />

      {/* ── Nordea ── */}
      <div className="wizard-platform-header">
        <span className="wizard-platform-title">Nordea</span>
        <span className="wizard-platform-subtitle">— Add any holding type</span>
      </div>
      <HoldingRows
        items={holdings.nordea}
        onChange={(v) => update('nordea', v)}
        defaultAssetClass="fund"
      />

      {/* ── KvarnX ── */}
      <div className="wizard-platform-header">
        <span className="wizard-platform-title">KvarnX</span>
        <span className="wizard-platform-subtitle">— Add crypto holdings</span>
      </div>
      <HoldingRows
        items={holdings.kvarnx}
        onChange={(v) => update('kvarnx', v)}
        defaultAssetClass="crypto"
      />

      {all.length > 0 && (
        <div className="wizard-holdings-summary">
          Your portfolio: {summaryParts} across {activePlatforms} platform{activePlatforms !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
