// backend/services/openrouter-client.js
//
// OpenAI-compatible client for OpenRouter's free-tier chat models.
// Tries each model in FREE_MODELS in order, falling to the next on any
// failure (HTTP error, timeout, malformed response). Throws only after
// every model passed in has failed.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;

// Ordered fallback list of free (:free) OpenRouter model IDs.
// OpenRouter's free lineup rotates and gets delisted without notice —
// re-verify at https://openrouter.ai/models?max_price=0 before changing.
// Last verified: 2026-08-18.
export const FREE_MODELS = [
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-9b-v2:free',
  'inclusionai/ling-3.0-flash:free',
];

const SYSTEM_PROMPT =
  'You are a helpful investing-portfolio assistant in a public demo app. ' +
  'The demo shows sample data only, not real holdings. Keep answers concise ' +
  'and clearly framed as general information, not financial advice.';

async function callModel(model, query, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://investing-agent-demo.vercel.app',
        'X-Title': 'Investing Agent Demo',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${model} returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`OpenRouter ${model} returned no message content`);
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Try each model in FREE_MODELS (or a caller-supplied subset) in order.
 * Returns { text, model, attempts } from the first model that succeeds —
 * attempts is how many models were actually called (1 = first one worked).
 * Throws an Error listing all failures if every model fails; the caller
 * knows models.length were attempted in that case.
 */
export async function chatWithOpenRouter(query, opts = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const models = opts.models ?? FREE_MODELS;
  if (models.length === 0) throw new Error('No OpenRouter models available to try');

  const errors = [];
  for (const model of models) {
    try {
      const text = await callModel(model, query, apiKey);
      return { text, model, attempts: errors.length + 1 };
    } catch (err) {
      console.warn(`[openrouter-client] ${model} failed: ${err.message}`);
      errors.push(`${model}: ${err.message}`);
    }
  }

  throw new Error(`All OpenRouter models failed — ${errors.join(' | ')}`);
}
