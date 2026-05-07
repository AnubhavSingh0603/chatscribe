import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
} from 'discord.js';
import { aiFactCheck } from '../ai/tasks.js';
import { factCheckEmbed, errorEmbed, warnEmbed } from '../utils/embeds.js';
import { checkAndSet } from '../utils/cooldowns.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Optional UX shortcut: right-click message → Apps → Fact Check.
async function runFactCheck(interaction, statement, originalAuthor) {
  if (!statement || !statement.trim()) {
    await interaction.reply({
      embeds: [errorEmbed('Nothing to check', 'The target message has no text content.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const remaining = checkAndSet(
    'factcheck',
    interaction.user.id,
    config.limits.factcheckCooldownSeconds
  );
  if (remaining > 0) {
    await interaction.reply({
      embeds: [warnEmbed('Slow down', `You can use fact-check again in **${remaining}s**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();
  try {
    const result = await aiFactCheck(statement);
    const embed = factCheckEmbed({
      type: result.type,
      verdict: result.verdict,
      result: result.result,
      explanation: result.explanation,
      confidence: result.confidence,
      original: originalAuthor ? `${originalAuthor}: ${statement}` : statement,
    });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('factcheck failed:', err);
    await interaction.editReply({
      embeds: [
        errorEmbed(
          'Fact-check failed',
          'The AI service is unavailable right now. Please try again in a moment.'
        ),
      ],
    });
  }
}

export const factcheckContext = {
  data: new ContextMenuCommandBuilder()
    .setName('Fact Check')
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.targetMessage;
    if (!target) {
      await interaction.reply({
        embeds: [errorEmbed('No target', 'Could not read the target message.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await runFactCheck(interaction, target.content, target.author?.username);
  },
};
