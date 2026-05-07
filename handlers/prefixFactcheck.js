import { MessageFlags } from 'discord.js';
import { aiFactCheck } from '../ai/tasks.js';
import { factCheckEmbed, errorEmbed, warnEmbed } from '../utils/embeds.js';
import { checkAndSet } from '../utils/cooldowns.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export function isFactcheckCommand(message) {
  return /^!(factcheck|fc|check|explain)\b/i.test(message.content.trim());
}

function commandMode(message) {
  return /^!explain\b/i.test(message.content.trim()) ? 'explain' : 'check';
}

export async function handlePrefixFactcheck(message) {
  const remaining = checkAndSet(
    'factcheck',
    message.author.id,
    config.limits.factcheckCooldownSeconds
  );

  if (remaining > 0) {
    await message.reply({
      embeds: [warnEmbed('Slow down', `You can use \`!factcheck\` again in **${remaining}s**.`)],
    });
    return;
  }

  const ref = message.reference?.messageId;
  if (!ref) {
    await message.reply({
      embeds: [errorEmbed('Reply required', 'Reply to a message with `!factcheck`, `!fc`, `!check`, or `!explain`.')],
    });
    return;
  }

  let target;
  try {
    target = await message.channel.messages.fetch(ref);
  } catch {
    await message.reply({
      embeds: [errorEmbed('Message not found', 'I could not fetch the replied-to message.')],
    });
    return;
  }

  const statement = target.content?.trim();
  if (!statement) {
    await message.reply({
      embeds: [errorEmbed('Nothing to check', 'The replied-to message has no text content.')],
    });
    return;
  }

  try {
    await message.channel.sendTyping().catch(() => {});
    const result = await aiFactCheck(statement, { commandMode: commandMode(message) });
    await message.reply({
      embeds: [
        factCheckEmbed({
          type: result.type,
          verdict: result.verdict,
          result: result.result,
          explanation: result.explanation,
          confidence: result.confidence,
          original: target.author ? `${target.author.username}: ${statement}` : statement,
        }),
      ],
    });
  } catch (err) {
    logger.error('prefix factcheck failed:', err);
    await message.reply({
      embeds: [
        errorEmbed(
          'Fact-check failed',
          'The AI service is unavailable right now. Please try again in a moment.'
        ),
      ],
    });
  }
}
