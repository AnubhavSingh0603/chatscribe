import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

export const readyHandler = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag} (id: ${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s).`);
  },
};
