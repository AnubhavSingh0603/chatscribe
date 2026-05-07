import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { ALL_COMMANDS } from './commands/index.js';
import { logger } from './utils/logger.js';

async function main() {
  const body = ALL_COMMANDS.map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  if (config.discord.devGuildId) {
    logger.info(`Registering ${body.length} commands to dev guild ${config.discord.devGuildId}…`);
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.devGuildId),
      { body }
    );
    logger.info('Guild commands registered (instant).');
  } else {
    logger.info(`Registering ${body.length} commands GLOBALLY (may take up to ~1h to propagate)…`);
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
    logger.info('Global commands registered.');
  }
}

main().catch((err) => {
  logger.error('deploy-commands failed:', err);
  process.exit(1);
});
