import React, { useState } from 'react';
import './OpportunityCard.css';

const RISK_CLS = { LOW: 'text-green', MEDIUM: 'text-yellow', HIGH: 'text-red' };

export default function OpportunityCard({ opp }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="opp-card">
      <div className="opp-card-header">
        <div>
          <span className="opp-ticker">{opp.ticker}</span>
          <span className="opp-exchange text-muted">{opp.exchange}</span>
        </div>
        <div className="opp-card-right">
          <span className={`badge ${opp.upside.startsWith('+') ? 'badge-green' : 'badge-red'}`}>
            {opp.upside}
          </span>
          <span className={`badge badge-muted ${RISK_CLS[opp.risk]}`}>{opp.risk} RISK</span>
        </div>
      </div>

      <div className="opp-name">{opp.name}</div>
      <div className="opp-horizon text-muted">Horizon: {opp.timeHorizon}</div>
      <div className="opp-prices text-mono">
        Current: <strong>${opp.currentPrice.toLocaleString()}</strong>
        &nbsp;→ Target: <strong className="text-green">${opp.targetPrice.toLocaleString()}</strong>
      </div>

      <p className="opp-thesis">{opp.thesis}</p>

      <button className="opp-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▲ Less' : '▼ Catalysts & Risks'}
      </button>

      {expanded && (
        <div className="opp-expanded">
          <div className="opp-section-label">Catalysts</div>
          <ul className="opp-list">
            {opp.catalysts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <div className="opp-section-label">Risks</div>
          <ul className="opp-list">
            {opp.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <div className="opp-section-label">Relevance to Portfolio</div>
          <p className="opp-text">{opp.relevance}</p>
        </div>
      )}
    </div>
  );
}
