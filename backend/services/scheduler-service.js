import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { generateDailyBriefing } from './scheduled-job-service.js';
import { generateWeeklyReport } from './scheduled-job-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(__dirname, '..', 'generated');

function ensureGeneratedDir() {
  mkdirSync(GENERATED_DIR, { recursive: true });
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

async function runDailyJob() {
  ensureGeneratedDir();
  const data    = await generateDailyBriefing();
  const dateStr = new Date().toISOString().split('T')[0];
  const dated   = resolve(GENERATED_DIR, `daily-${dateStr}.json`);
  const latest  = resolve(GENERATED_DIR, 'latest-daily.json');
  const payload = JSON.stringify(data, null, 2);
  writeFileSync(dated,  payload, 'utf8');
  writeFileSync(latest, payload, 'utf8');
  console.log(`Daily briefing written to ${dated} and latest-daily.json`);
  return { path: dated, latest, date: dateStr };
}

async function runWeeklyJob() {
  ensureGeneratedDir();
  const data    = await generateWeeklyReport();
  const now     = new Date();
  const week    = getISOWeek(now);
  const weekStr = `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
  const dated   = resolve(GENERATED_DIR, `weekly-${weekStr}.json`);
  const latest  = resolve(GENERATED_DIR, 'latest-weekly.json');
  const payload = JSON.stringify(data, null, 2);
  writeFileSync(dated,  payload, 'utf8');
  writeFileSync(latest, payload, 'utf8');
  console.log(`Weekly report written to ${dated} and latest-weekly.json`);
  return { path: dated, latest, week: weekStr };
}

export async function triggerJob(type) {
  if (type === 'daily') return runDailyJob();
  if (type === 'weekly') return runWeeklyJob();
  throw new Error(`Unknown job type: ${type}`);
}

export function startScheduler(dailyTime = '08:00', weeklyDay = 'Monday', timezone = 'Europe/Helsinki') {
  const [hour, minute] = dailyTime.split(':');
  const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0 };
  const dayNum = dayMap[weeklyDay] ?? 1;

  cron.schedule(`${minute} ${hour} * * *`, runDailyJob, { timezone });
  console.log(`Daily alert scheduled: ${dailyTime} ${timezone}`);

  cron.schedule(`0 7 * * ${dayNum}`, runWeeklyJob, { timezone });
  console.log(`Weekly report scheduled: ${weeklyDay} 07:00 ${timezone}`);
}
