import { deleteOldMessages } from '../db/queries.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let timer = null;

export function startCleanupJob() {
  const intervalMs = config.limits.cleanupIntervalMinutes * 60 * 1000;

  const run = async () => {
    try {
      const r = await deleteOldMessages();
      if (r.byAge || r.byCap || r.summaries) {
        logger.info(
          `Cleanup: pruned ${r.byAge} raw by age, ${r.byCap} raw by per-channel cap, ${r.summaries} old summaries.`
        );
      }
    } catch (err) {
      logger.error('Cleanup job error:', err);
    }
  };

  // Run once on startup so a freshly deployed bot trims any stale data immediately.
  run();
  timer = setInterval(run, intervalMs);
  timer.unref?.();
  logger.info(`Cleanup job scheduled every ${config.limits.cleanupIntervalMinutes} min.`);
}

export function stopCleanupJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
