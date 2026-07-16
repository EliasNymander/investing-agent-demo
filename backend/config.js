import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

dotenv.config({ path: resolve(ROOT, '.env') });

const USER_CONFIG_PATH = resolve(ROOT, 'user_config.json');

function loadUserConfig() {
  if (!existsSync(USER_CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(USER_CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

const userConfig = loadUserConfig();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  useMock: process.env.USE_CLAUDE_MOCK !== 'false',
  userConfigPath: USER_CONFIG_PATH,
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY || userConfig?.apiKeys?.anthropic || '',
    alphaVantage: process.env.ALPHA_VANTAGE_API_KEY || userConfig?.apiKeys?.alphaVantage || '',
    coinGecko: process.env.COINGECKO_API_KEY || userConfig?.apiKeys?.coinGecko || '',
    newsApi: process.env.NEWS_API_KEY || userConfig?.apiKeys?.newsApi || '',
  },
  userConfig,
};

export default config;
