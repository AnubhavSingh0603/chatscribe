import { getGuildConfig } from '../db/queries.js';

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // guildId -> { value, expires }

export async function getCachedGuildConfig(guildId) {
  const now = Date.now();
  const hit = cache.get(guildId);
  if (hit && hit.expires > now) return hit.value;
  const value = await getGuildConfig(guildId);
  cache.set(guildId, { value, expires: now + TTL_MS });
  return value;
}

export function invalidateGuildConfig(guildId) {
  cache.delete(guildId);
}

export function setGuildConfig(guildId, value) {
  cache.set(guildId, { value, expires: Date.now() + TTL_MS });
}
