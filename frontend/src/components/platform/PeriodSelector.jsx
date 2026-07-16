import React from 'react';
import './PeriodSelector.css';

const PERIODS = ['1D', '1W', '1M', '3M', '6M', '1Y'];

export default function PeriodSelector({ selected, onChange }) {
  return (
    <div className="period-selector">
      {PERIODS.map((p) => (
        <button
          key={p}
          className={`period-btn ${selected === p ? 'active' : ''}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
