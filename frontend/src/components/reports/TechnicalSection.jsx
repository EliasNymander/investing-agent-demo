import React from 'react';
import './TechnicalSection.css';

function RsiGauge({ rsi, signal }) {
  if (rsi == null) return <span className="text-muted text-mono">N/A</span>;
  const cls = rsi >= 70 ? 'text-red' : rsi <= 30 ? 'text-green' : 'text-yellow';
  return (
    <span className={`text-mono ${cls}`}>
      {rsi.toFixed(1)}
      <span className="tech-signal"> {signal}</span>
    </span>
  );
}

function MacdArrow({ direction }) {
  if (!direction) return <span className="text-muted">N/A</span>;
  return (
    <span className={direction === 'bullish' ? 'text-green' : 'text-red'}>
      {direction === 'bullish' ? '▲ Bullish' : '▼ Bearish'}
    </span>
  );
}

function MaPosition({ price, ma50, ma200 }) {
  if (!ma50 && !ma200) return <span className="text-muted">N/A</span>;
  const vs50 = ma50 ? (price > ma50 ? '↑50MA' : '↓50MA') : '';
  const vs200 = ma200 ? (price > ma200 ? '↑200MA' : '↓200MA') : '';
  const cls50 = ma50 ? (price > ma50 ? 'text-green' : 'text-red') : '';
  const cls200 = ma200 ? (price > ma200 ? 'text-green' : 'text-red') : '';
  return (
    <span className="text-mono">
      <span className={cls50}>{vs50}</span>
      {vs50 && vs200 && ' '}
      <span className={cls200}>{vs200}</span>
    </span>
  );
}

export default function TechnicalSection({ technicals }) {
  if (!technicals) return null;

  const stocks = technicals.filter((t) => t.rsi != null || t.benchmarkPerf != null);

  return (
    <div className="tech-section">
      <table className="tech-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="text-right">RSI</th>
            <th>MACD</th>
            <th>vs Moving Avg</th>
            <th className="text-right">Week %</th>
            <th>Analyst Target</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((t) => (
            <tr key={t.ticker}>
              <td className="text-mono font-bold">{t.ticker}</td>
              <td className="text-right">
                {t.rsi != null
                  ? <RsiGauge rsi={t.rsi} signal={t.rsiSignal} />
                  : <span className="text-muted" title={t.note}>vs BM {t.vsBenchmark >= 0 ? '+' : ''}{t.vsBenchmark?.toFixed(2)}%</span>
                }
              </td>
              <td>
                {t.macd
                  ? <MacdArrow direction={t.macd.direction} />
                  : <span className="text-muted">—</span>
                }
              </td>
              <td>
                {t.ma50 || t.ma200
                  ? <MaPosition price={t.currentPrice} ma50={t.ma50} ma200={t.ma200} />
                  : <span className="text-muted">—</span>
                }
              </td>
              <td className={`text-right text-mono ${t.weekPerf >= 0 ? 'text-green' : 'text-red'}`}>
                {t.weekPerf >= 0 ? '+' : ''}{t.weekPerf?.toFixed(2)}%
              </td>
              <td className="text-mono text-muted">
                {t.consensusTarget
                  ? `${t.ticker.includes('-') ? '€' : t.ticker.includes('SEK') ? 'kr' : '$'}${t.consensusTarget.toLocaleString()}`
                  : '—'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
