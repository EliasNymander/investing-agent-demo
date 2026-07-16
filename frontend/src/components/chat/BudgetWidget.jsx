import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext.jsx';
import { fetchBudgetStatus } from '../../api/budget.js';

const MONTHLY_CAP = 2.15;

function colorClass(pct) {
  if (pct >= 90) return 'chat-budget-bar--red';
  if (pct >= 60) return 'chat-budget-bar--amber';
  return 'chat-budget-bar--green';
}

export default function BudgetWidget() {
  const { isOpen } = useChat();
  const [status, setStatus] = useState(null);

  // Refresh every time the panel opens
  useEffect(() => {
    if (!isOpen) return;
    fetchBudgetStatus()
      .then(setStatus)
      .catch(() => {});
  }, [isOpen]);

  if (!status) return null;

  const pct     = status.monthlyPercentUsed ?? 0;
  const spend   = (status.monthlySpend ?? 0).toFixed(2);
  const daily   = (status.dailySpend   ?? 0).toFixed(4);
  const calls   = status.callsRemainingToday ?? '—';
  const tooltip = [
    `Daily:   $${daily} / $${status.dailyCap}  (${calls} calls left today)`,
    `Monthly: $${spend} / $${MONTHLY_CAP}`,
    `Resets:  daily at midnight · monthly on the 1st`,
  ].join('\n');

  return (
    <div
      className={`chat-budget-bar ${colorClass(pct)}`}
      title={tooltip}
      aria-label={`Claude API budget: $${spend} of $${MONTHLY_CAP} used this month`}
    >
      <span className="chat-budget-label">Claude budget</span>
      <div className="chat-budget-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="chat-budget-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="chat-budget-amount">${spend} / ${MONTHLY_CAP}</span>
    </div>
  );
}
