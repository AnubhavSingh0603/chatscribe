import { chatComplete, parseJsonLoose } from './client.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { enabledLeafPrompts, normalizeAlertSettings } from '../utils/alertSettings.js';

// ---------- Reply Inspector / Fact Check ----------

const FACT_SYSTEM = `You are ChatScribe's reply inspector for Discord.
A user replied to a message with !factcheck / !fc / !check / !explain.
You must decide what kind of message it is and respond helpfully.

Respond with a JSON object ONLY — no prose, no markdown — matching exactly:
{
  "type": "FACT_CLAIM" | "QUESTION" | "IDENTIFICATION_REQUEST" | "OPINION" | "JOKE_OR_SARCASM" | "EXPLANATION_REQUEST" | "NEEDS_CONTEXT",
  "verdict": "TRUE" | "FALSE" | "UNCERTAIN" | "NOT_APPLICABLE",
  "result": "short answer or result, max 120 words",
  "explanation": "useful details, max 120 words",
  "confidence": <integer 0-100>
}
Rules:
- If the replied message is a factual claim, fact-check it.
- If it is a question, answer it instead of forcing a true/false verdict.
- If it asks to identify something, provide identification help if text context allows; say what extra context is needed if not.
- If it is an opinion, explain that it is subjective and optionally give a neutral framing.
- If it is a joke/sarcasm/meme, identify that and mention whether literal interpretation would be false only if useful.
- If command_mode is EXPLAIN, prioritize explaining the message simply.
- Keep language concise and friendly. Do not invent facts when uncertain.`;

export async function aiFactCheck(statement, { commandMode = 'check' } = {}) {
  const trimmed = statement.slice(0, 1800);
  const raw = await chatComplete({
    system: FACT_SYSTEM,
    user: `command_mode: ${commandMode === 'explain' ? 'EXPLAIN' : 'CHECK'}\nReplied message:\n${trimmed}`,
    temperature: 0.1,
    maxTokens: 520,
  });
  const json = parseJsonLoose(raw);
  const type = normalizeType(json.type);
  const verdict = normalizeVerdict(json.verdict, type);
  return {
    type,
    verdict,
    result: capWords(String(json.result || ''), 120),
    explanation: capWords(String(json.explanation || ''), 120),
    confidence: clampInt(json.confidence, 0, 100, 50),
  };
}

function normalizeType(v) {
  const s = String(v || '').toUpperCase().trim();
  const allowed = ['FACT_CLAIM', 'QUESTION', 'IDENTIFICATION_REQUEST', 'OPINION', 'JOKE_OR_SARCASM', 'EXPLANATION_REQUEST', 'NEEDS_CONTEXT'];
  return allowed.includes(s) ? s : 'NEEDS_CONTEXT';
}

function normalizeVerdict(v, type) {
  const s = String(v || '').toUpperCase().trim();
  if (['TRUE', 'FALSE', 'UNCERTAIN', 'NOT_APPLICABLE'].includes(s)) return s;
  return type === 'FACT_CLAIM' ? 'UNCERTAIN' : 'NOT_APPLICABLE';
}

// ---------- Summarization ----------

const SUMMARY_SYSTEM = `You are ChatScribe, a friendly Discord channel summarizer.
You receive chronological recent messages plus optional prior summaries.
Produce a structured JSON object ONLY — no prose, no markdown — matching exactly:
{
  "topics":       [string, ...],
  "participants": [string, ...],
  "tone":         string,
  "highlights":   [string, ...],
  "context":      [string, ...],
  "risk_level":   "green" | "yellow" | "red",
  "risk_reason":  string
}
Rules:
- Summaries should be useful and moderately detailed for auto logs: include actual context, recurring jokes, arguments, and notable turns.
- Mention NSFW/flirty topics when they were a real part of the chat, but do not moralize or scare regular users.
- Treat consensual playful NSFW/flirty banter as green or yellow depending on intensity, not automatically red.
- Use yellow for slightly risky/edgy/flirty/argumentative content that may deserve light awareness.
- Use red only for content that likely needs moderator review: malicious harassment, threats, hate/bigotry, sexual violence/coercion, predatory content, doxxing, scams, or severe escalation.
- Do not invent participants. Use the speaker names exactly as provided.
- Keep each array item under 190 characters.
- Prefer recent messages over prior summaries when they conflict.`;

export async function aiSummarize({ messages, pastSummaries = [] }) {
  const formattedMessages = messages
    .map((m) => `${m.username}: ${truncate(m.content, 650)}`)
    .join('\n');

  const formattedPast = pastSummaries.length
    ? '\n\nPRIOR SUMMARIES (context only):\n' +
      pastSummaries
        .map((s, i) => `[${i + 1}] ${truncate(s.summary_text, 700)}`)
        .join('\n')
    : '';

  const raw = await chatComplete({
    system: SUMMARY_SYSTEM,
    user: `RECENT MESSAGES (oldest -> newest):\n${formattedMessages}${formattedPast}`,
    temperature: 0.25,
    maxTokens: 1250,
  });
  const json = parseJsonLoose(raw);
  const risk = normalizeRisk(json.risk_level);
  return {
    topics: toStringArray(json.topics).slice(0, 9),
    participants: toStringArray(json.participants).slice(0, 12),
    tone: String(json.tone || 'neutral').slice(0, 120),
    highlights: toStringArray(json.highlights).slice(0, 9),
    context: toStringArray(json.context).slice(0, 8),
    riskLevel: risk,
    riskReason: String(json.risk_reason || '').slice(0, 300),
  };
}

// ---------- Trigger Detection ----------

const TRIGGER_SYSTEM = (enabledRules) => `You are a Discord moderation triage classifier.
Your job is not to police every sensitive word. Alert only for configured, actionable moderation concerns.

Configured rules. Each rule has a mode:
- summary: awareness only; never create a mod alert by itself
- alert: create a mod alert when genuinely present
- ping: create a high-priority mod alert when genuinely present

Rules to detect:
${enabledRules.map((r) => `- key=${r.key} | mode=${r.mode} | ${r.categoryLabel} > ${r.subLabel} > ${r.label}`).join('\n')}

Respond with JSON ONLY — no prose, no markdown — matching exactly:
{
  "detected": [{"key":"one configured key", "label":"category > subcategory > leaf", "mode":"summary"|"alert"|"ping"}],
  "severity": "green" | "yellow" | "red",
  "evidence": "one short, neutral, non-graphic context sentence, or empty string if nothing serious detected",
  "relevant_message_indexes": [integer, ...]
}
Rules:
- Input messages are numbered like [1], [2], etc. Return only those indexes in relevant_message_indexes.
- Do NOT alert merely because playful NSFW/flirty banter, meme self-harm phrases, gaming violence, or casual edgy jokes exist.
- Bigotry, targeted harassment, credible threats, doxxing/privacy leaks, scams, sexual harassment/violence, minor safety, and severe/prolonged arguments are the main concerns.
- For escalating arguments, require signs of sustained hostile tone, dogpiling, or broad hostile generalizations; one spicy opinion alone is usually yellow or green.
- severity green: no configured concern or harmless banter.
- severity yellow: only summary-mode/light awareness concerns.
- severity red: at least one alert/ping-mode actionable concern.
- detected must contain only keys from the configured rules above.
- Keep evidence neutral and non-graphic.`;

export async function aiDetectTriggers(messages, alertSettings) {
  const settings = normalizeAlertSettings(alertSettings);
  const enabledRules = enabledLeafPrompts(settings, ['summary', 'alert', 'ping']);
  if (!enabledRules.length) return { detected: [], severity: 'green', evidence: '', relevantIndexes: [], shouldPing: false, shouldAlert: false };

  const formattedMessages = messages
    .map((m, i) => `[${i + 1}] ${m.username}: ${truncate(m.content, 450)}`)
    .join('\n');

  const raw = await chatComplete({
    system: TRIGGER_SYSTEM(enabledRules),
    user: `MESSAGES:\n${formattedMessages}`,
    temperature: 0.0,
    maxTokens: 750,
  });
  const json = parseJsonLoose(raw);
  const byKey = new Map(enabledRules.map((r) => [r.key, r]));
  const detectedObjects = Array.isArray(json.detected) ? json.detected : [];
  const detected = [];
  for (const item of detectedObjects) {
    const key = String(item?.key || '').trim();
    const rule = byKey.get(key);
    if (!rule) continue;
    detected.push({ key, label: `${rule.categoryLabel} > ${rule.subLabel} > ${rule.label}`, mode: rule.mode });
  }
  const highest = detected.some((d) => d.mode === 'ping') ? 'ping' : detected.some((d) => d.mode === 'alert') ? 'alert' : detected.some((d) => d.mode === 'summary') ? 'summary' : 'disabled';
  const severity = highest === 'ping' || highest === 'alert' ? 'red' : highest === 'summary' ? 'yellow' : normalizeRisk(json.severity);
  const relevantIndexes = Array.isArray(json.relevant_message_indexes)
    ? json.relevant_message_indexes
        .map((x) => parseInt(x, 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= messages.length)
        .slice(0, 5)
    : [];

  return {
    detected,
    severity,
    evidence: String(json.evidence || '').slice(0, 800),
    relevantIndexes,
    shouldAlert: highest === 'alert' || highest === 'ping',
    shouldPing: highest === 'ping',
  };
}

// ---------- helpers ----------

function toStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function clampInt(v, lo, hi, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function capWords(s, maxWords) {
  const words = String(s).split(/\s+/);
  if (words.length <= maxWords) return s.trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

function normalizeRisk(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'red') return 'red';
  if (s === 'yellow') return 'yellow';
  return 'green';
}

export { logger };
