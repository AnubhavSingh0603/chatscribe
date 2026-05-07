import { Events, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';
import { errorEmbed } from '../utils/embeds.js';
import { handleAlertPanelInteraction } from '../commands/alertPanel.js';

export const interactionCreateHandler = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const handled = await handleAlertPanelInteraction(interaction);
      if (handled) return;
    }
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Command "${interaction.commandName}" threw:`, err);
      const payload = {
        embeds: [
          errorEmbed(
            'Unexpected error',
            'Something went wrong while running this command. Please try again.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch (innerErr) {
        logger.error('Failed to deliver error reply:', innerErr);
      }
    }
  },
};
