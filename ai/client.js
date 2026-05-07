import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ENDPOINT = `${config.ai.baseUrl.replace(/\/+$/, '')}/chat/completions`;

/**
 * One chat completion call. Returns the raw assistant string.
 * Throws on non-2xx after retries.
 */
export async function chatComplete({ system, user, temperature = 0.2, maxTokens = 800, jsonMode = true }) {
  const body = {
    model: config.ai.model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (jsonMode) {
    // Most OpenAI-compatible providers (Groq, OpenAI, Together) honour this.
    body.response_format = { type: 'json_object' };
  }

  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        // 429 / 5xx are retryable.
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          const wait = 500 * 2 ** (attempt - 1);
          logger.warn(`AI ${res.status}, retry in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw new Error(`AI HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('AI response missing content');
      return content;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

function buildHeaders() {
  const headers = {
    Authorization: `Bearer ${config.ai.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (process.env.AI_HTTP_REFERER?.trim()) headers['HTTP-Referer'] = process.env.AI_HTTP_REFERER.trim();
  if (process.env.AI_APP_TITLE?.trim()) headers['X-Title'] = process.env.AI_APP_TITLE.trim();
  return headers;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse JSON from model output, tolerating ```json fences and stray prose.
 */
export function parseJsonLoose(raw) {
  if (!raw) throw new Error('Empty AI response');
  let s = raw.trim();
  // Strip code fences.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    // Last-resort: extract first {...} block.
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Could not parse AI JSON: ${s.slice(0, 200)}`);
  }
}
