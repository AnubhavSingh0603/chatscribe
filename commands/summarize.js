import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { aiSummarize } from '../ai/tasks.js';
import { privateSummaryEmbed, errorEmbed } from '../utils/embeds.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const summarize = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Privately summarize the last N messages of this channel.')
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription(`Number of messages to summarize (1-${config.limits.manualSummaryMaxN})`)
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(config.limits.manualSummaryMaxN)
    )
    .setDMPermission(false),

  async execute(interaction) {
    const n = interaction.options.getInteger('count', true);

    if (n < 1 || n > config.limits.manualSummaryMaxN) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            'Invalid count',
            `Please provide a value between 1 and ${config.limits.manualSummaryMaxN}.`
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const channel = interaction.channel;
      const fetched = await channel.messages.fetch({ limit: n });
      const messages = [...fetched.values()]
        .filter((m) => !m.author.bot && m.content?.trim())
        .reverse() // oldest -> newest
        .map((m) => ({ username: m.author.displayName || m.author.username, content: m.content }));

      if (messages.length < 2) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              'Not enough messages',
              'I need at least 2 non-bot messages with text content to summarize.'
            ),
          ],
        });
        return;
      }

      const result = await aiSummarize({ messages });
      const embed = privateSummaryEmbed({
        ...result,
        count: messages.length,
      });
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('summarize failed:', err);
      await interaction.editReply({
        embeds: [
          errorEmbed(
            'Summary failed',
            'The AI service or message fetch failed. Please try again later.'
          ),
        ],
      });
    }
  },
};
