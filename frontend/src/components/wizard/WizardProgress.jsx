import React from 'react';
import './WizardProgress.css';

const LABELS = ['1. Holdings', '2. API Keys', '3. Schedule'];

export default function WizardProgress({ step, total }) {
  return (
    <div className="wizard-progress">
      {LABELS.slice(0, total).map((label, i) => {
        const num = i + 1;
        const state = num < step ? 'done' : num === step ? 'active' : 'pending';
        return (
          <React.Fragment key={label}>
            <div className={`wizard-step wizard-step--${state}`}>
              <div className="wizard-step-dot">{state === 'done' ? '✓' : num}</div>
              <span className="wizard-step-label">{label}</span>
            </div>
            {i < total - 1 && <div className={`wizard-connector ${state === 'done' ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
