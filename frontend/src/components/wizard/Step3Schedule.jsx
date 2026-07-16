import React from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMEZONES = ['Europe/Helsinki', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/London', 'America/New_York', 'UTC'];
const TIMES = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  return [`${h}:00`, `${h}:30`];
}).flat();

export default function Step3Schedule({ schedule, onChange }) {
  const update = (field, value) => onChange({ ...schedule, [field]: value });

  return (
    <div>
      <div className="wizard-step-title">Report Schedule</div>
      <div className="wizard-step-desc">
        Set when you want to receive your daily alerts and weekly deep-dive reports.
        The scheduler runs automatically in the background when the app is running.
      </div>
      <div className="wizard-sched-rows">
        <div className="wizard-sched-row">
          <label className="wizard-sched-label">Daily Alert Time</label>
          <select className="wizard-select" value={schedule.dailyAlertTime} onChange={(e) => update('dailyAlertTime', e.target.value)}>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="wizard-sched-row">
          <label className="wizard-sched-label">Weekly Report Day</label>
          <select className="wizard-select" value={schedule.weeklyReportDay} onChange={(e) => update('weeklyReportDay', e.target.value)}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="wizard-sched-row">
          <label className="wizard-sched-label">Timezone</label>
          <select className="wizard-select" value={schedule.timezone} onChange={(e) => update('timezone', e.target.value)}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
