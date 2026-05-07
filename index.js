import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { initSchema } from './db/init.js';
import { pool } from './db/pool.js';
import { buildCommandCollection } from './commands/index.js';
import { readyHandler } from './handlers/ready.js';
import { messageCreateHandler } from './handlers/messageCreate.js';
import { interactionCreateHandler } from './handlers/interactionCreate.js';
import { startCleanupJob, stopCleanupJob } from './jobs/cleanup.js';
import { logger } from './utils/logger.js';

async function main() {
  // 1. Schema check (idempotent).
  await initSchema();

  // 2. Discord client with the minimal set of intents required.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.commands = buildCommandCollection();

  // 3. Wire up event handlers.
  for (const h of [readyHandler, messageCreateHandler, interactionCreateHandler]) {
    if (h.once) client.once(h.name, (...args) => h.execute(...args));
    else client.on(h.name, (...args) => h.execute(...args));
  }

  // 4. Start cleanup loop.
  startCleanupJob();

  // 5. Connect.
  await client.login(config.discord.token);

  // 6. Graceful shutdown.
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down…`);
    stopCleanupJob();
    try { await client.destroy(); } catch {}
    try { await pool.end(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => logger.error('unhandledRejection:', err));
  process.on('uncaughtException',  (err) => logger.error('uncaughtException:', err));
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
