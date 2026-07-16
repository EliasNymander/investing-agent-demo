import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '..', 'cache');
const STATE_FILE = resolve(CACHE_DIR, 'demo-mode.json');

function readState() {
  if (!existsSync(STATE_FILE)) return true;
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')).isDemoMode ?? false; }
  catch { return false; }
}

export function isDemoMode() {
  return readState();
}

export function setDemoMode(enabled) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ isDemoMode: Boolean(enabled) }, null, 2), 'utf-8');
}
