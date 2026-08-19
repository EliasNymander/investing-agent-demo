// backend/services/redis-client.js
//
// Shared Upstash Redis client for the chat-only backend's abuse-protection
// state (SCRUM-59): the daily OpenRouter budget counter, the per-session
// live-reply cap, and the rate limiter. Upstash's client is REST-based
// (plain HTTPS, no persistent connection) -- which is exactly what makes
// it a fit here: Render's free tier has no persistent filesystem and no
// long-lived process guarantee across spin-down/spin-up, but this state
// now lives somewhere that actually survives those cycles.

import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.warn(
    '[redis-client] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — ' +
    'abuse-protection checks will fail closed (mock replies only) until these are configured in Render.'
  );
}

export const redis = new Redis({ url, token });
