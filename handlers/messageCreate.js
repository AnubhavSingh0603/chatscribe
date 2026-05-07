import { Events } from 'discord.js';
import { insertMessage, countMessages } from '../db/queries.js';
import { getCachedGuildConfig } from '../utils/cache.js';
import { runSummarizationCycle } from './summarizer.js';
import { isFactcheckCommand, handlePrefixFactcheck } from './prefixFactcheck.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const messageCreateHandler = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      // Ignore bots, system messages, DMs, and empty content.
      if (message.author?.bot) return;
      if (!message.guildId) return;
      if (!message.content || !message.content.trim()) return;

      // User-facing prefix command works in any readable text channel.
      if (isFactcheckCommand(message)) {
        await handlePrefixFactcheck(message);
        return; // Do not store command messages.
      }

      const cfg = await getCachedGuildConfig(message.guildId);
      const enabled = cfg?.enabled_channels || [];
      if (!enabled.includes(message.channelId)) return;

      await insertMessage({
        guildId: message.guildId,
        channelId: message.channelId,
        userId: message.author.id,
        messageId: message.id,
        content: message.content.slice(0, config.limits.messageStoreCharLimit),
      });

      const count = await countMessages(message.channelId);
      if (count >= config.limits.summaryTriggerCount) {
        // Fire and forget; the cycle has its own per-channel lock.
        runSummarizationCycle({
          client: message.client,
          guildId: message.guildId,
          channelId: message.channelId,
          guildConfig: cfg,
        }).catch((err) => logger.error('Summarization fire-and-forget error:', err));
      }
    } catch (err) {
      logger.error('messageCreate handler error:', err);
    }
  },
};
