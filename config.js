import 'dotenv/config';

function required(key) {
  const v = process.env[key];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v.trim();
}

function intEnv(key, fallback) {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    devGuildId: process.env.DISCORD_DEV_GUILD_ID?.trim() || null,
  },
  db: {
    url: required('DATABASE_URL'),
  },
  ai: {
    apiKey: required('AI_API_KEY'),
    baseUrl: process.env.AI_BASE_URL?.trim() || 'https://api.groq.com/openai/v1',
    model: process.env.AI_MODEL?.trim() || 'llama-3.3-70b-versatile',
  },
  limits: {
    summaryTriggerCount: intEnv('SUMMARY_TRIGGER_COUNT', 300),
    maxMessagesPerChannel: intEnv('MAX_MESSAGES_PER_CHANNEL', 1000),
    messageRetentionHours: intEnv('MESSAGE_RETENTION_HOURS', 24),
    cleanupIntervalMinutes: intEnv('CLEANUP_INTERVAL_MINUTES', 60),
    factcheckCooldownSeconds: intEnv('FACTCHECK_COOLDOWN_SECONDS', 10),
    manualSummaryMaxN: 100,
    messageStoreCharLimit: intEnv('MESSAGE_STORE_CHAR_LIMIT', 1200),
    summaryRetentionDays: intEnv('SUMMARY_RETENTION_DAYS', 90),
  },
  trigger: {
    categories: [
      'sexual violence or coercion',
      'racism or hate speech',
      'politics or religion escalation',
      'malicious harassment or threats',
      'doxxing or privacy risk',
      'extremism or violent praise',
      'high-intensity NSFW escalation',
    ],
  },
};
