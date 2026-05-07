import {
  fetchOldestMessages,
  deleteMessagesByIds,
  fetchPastSummaries,
  insertSummary,
} from '../db/queries.js';
import { aiSummarize, aiDetectTriggers } from '../ai/tasks.js';
import { summaryEmbed, alertEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// Per-channel locks so two simultaneous triggers in this process can't double-summarize.
const inFlight = new Set();

export async function runSummarizationCycle({ client, guildId, channelId, guildConfig }) {
  if (inFlight.has(channelId)) return;
  inFlight.add(channelId);
  try {
    const batch = await fetchOldestMessages(channelId, config.limits.summaryTriggerCount);
    if (batch.length < config.limits.summaryTriggerCount) {
      logger.debug(`Skip summarize: only ${batch.length} messages available`);
      return;
    }

    const displayNames = await resolveDisplayNames(client, guildId, batch.map((r) => r.user_id));
    const messages = batch.map((r) => ({
      username: displayNames.get(r.user_id) || `User ${String(r.user_id).slice(-4)}`,
      userId: r.user_id,
      messageId: r.message_id,
      channelId: r.channel_id || channelId,
      guildId: r.guild_id || guildId,
      content: r.content,
    }));
    const past = await fetchPastSummaries(channelId, 3);

    const summary = await aiSummarize({ messages, pastSummaries: past });

    const timeRangeStart = batch[0].timestamp;
    const timeRangeEnd = batch[batch.length - 1].timestamp;

    const summaryText = composeSummaryText(summary);
    await insertSummary({
      guildId,
      channelId,
      summaryText,
      detectedTopics: [], // Public summaries do not expose trigger categories.
      participants: summary.participants,
      tone: summary.tone,
      highlights: summary.highlights,
      timeRangeStart,
      timeRangeEnd,
    });

    // Post public summary first. It can be green/yellow/red but stays non-alarming and non-graphic.
    const summaryChannelId = guildConfig?.summary_channel_id || channelId;
    await postEmbed(client, summaryChannelId, summaryEmbed({
      ...summary,
      count: batch.length,
      channelMention: `<#${channelId}>`,
      timeRangeStart,
      timeRangeEnd,
    }));

    // Trigger detection is separate and mod-only. If no alert channel is configured, do not post alerts publicly.
    try {
      const triggers = await aiDetectTriggers(messages, guildConfig?.alert_settings);
      const shouldAlert = triggers.shouldAlert && triggers.detected.length > 0;
      if (shouldAlert) {
        const alertChannelId = guildConfig?.alert_channel_id;
        if (!alertChannelId) {
          logger.warn(`Red-level triggers detected in ${channelId}, but no alert channel is configured; not posting publicly.`);
        } else {
          const links = makeJumpLinks(messages, triggers.relevantIndexes);
          await postEmbed(
            client,
            alertChannelId,
            alertEmbed({
              categories: triggers.detected,
              severity: triggers.severity,
              evidence: triggers.evidence,
              links,
              channelMention: `<#${channelId}>`,
              timeRangeStart,
              timeRangeEnd,
            }),
            triggers.shouldPing ? makeRolePingPayload(guildConfig?.alert_role_id) : {}
          );
        }
      }
    } catch (err) {
      logger.error('Trigger detection failed:', err);
    }

    // Delete only after successful AI summary + summary persistence + posting attempts.
    // This keeps DB lean while preventing data loss if the main AI summary/save failed.
    await deleteMessagesByIds(batch.map((r) => r.id));
  } catch (err) {
    // Messages remain in DB if AI summary/save fails, so the next cycle can retry.
    logger.error('Summarization cycle failed:', err);
  } finally {
    inFlight.delete(channelId);
  }
}

function composeSummaryText(s) {
  const parts = [];
  if (s.topics?.length) parts.push(`Topics: ${s.topics.join(', ')}`);
  if (s.context?.length) parts.push(`Context: ${s.context.join(' | ')}`);
  if (s.tone) parts.push(`Tone: ${s.tone}`);
  if (s.highlights?.length) parts.push(`Highlights: ${s.highlights.join(' | ')}`);
  if (s.riskLevel) parts.push(`Risk: ${s.riskLevel}${s.riskReason ? ` - ${s.riskReason}` : ''}`);
  return parts.join('\n');
}

function makeJumpLinks(messages, relevantIndexes) {
  const chosen = relevantIndexes?.length
    ? relevantIndexes.map((n) => messages[n - 1]).filter(Boolean)
    : [];
  return chosen
    .filter((m) => m.guildId && m.channelId && m.messageId)
    .slice(0, 5)
    .map((m) => `https://discord.com/channels/${m.guildId}/${m.channelId}/${m.messageId}`);
}

function makeRolePingPayload(roleId) {
  if (!roleId) return {};
  return {
    content: `<@&${roleId}>`,
    allowedMentions: { roles: [roleId] },
  };
}

async function resolveDisplayNames(client, guildId, userIds) {
  const out = new Map();
  const unique = [...new Set(userIds.filter(Boolean))];
  try {
    const guild = await client.guilds.fetch(guildId);
    for (const userId of unique) {
      try {
        const member = await guild.members.fetch(userId);
        const name = member.displayName || member.user?.globalName || member.user?.username;
        if (name) out.set(userId, name);
      } catch {
        out.set(userId, `User ${String(userId).slice(-4)}`);
      }
    }
  } catch (err) {
    logger.warn(`Could not resolve display names for guild ${guildId}:`, err.message);
  }
  return out;
}

async function postEmbed(client, channelId, embed, extra = {}) {
  try {
    const ch = await client.channels.fetch(channelId);
    if (ch && typeof ch.send === 'function') {
      await ch.send({ ...extra, embeds: [embed] });
    }
  } catch (err) {
    logger.warn(`Could not post to channel ${channelId}:`, err.message);
  }
}
