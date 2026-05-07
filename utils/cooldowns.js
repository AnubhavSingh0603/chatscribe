/**
 * Lightweight per-user cooldown tracker.
 * Map<key, expiresAt-ms-epoch>. Expired entries are pruned lazily.
 */
const stores = new Map();

function getStore(name) {
  let s = stores.get(name);
  if (!s) {
    s = new Map();
    stores.set(name, s);
  }
  return s;
}

/**
 * Returns 0 if not on cooldown (and starts a new one),
 * or the remaining seconds if still on cooldown.
 */
export function checkAndSet(name, key, seconds) {
  const store = getStore(name);
  const now = Date.now();
  const exp = store.get(key);
  if (exp && exp > now) {
    return Math.ceil((exp - now) / 1000);
  }
  store.set(key, now + seconds * 1000);
  return 0;
}

// Periodic prune to avoid unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [k, exp] of store) {
      if (exp <= now) store.delete(k);
    }
  }
}, 60_000).unref();
