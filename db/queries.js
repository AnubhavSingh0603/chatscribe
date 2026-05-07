import { query, withTransaction } from './pool.js';
import { config } from '../config.js';
import { normalizeAlertSettings } from '../utils/alertSettings.js';

// ---------- messages ----------

export async function insertMessage({ guildId, channelId, userId, messageId, content }) {
  await query(
    `INSERT INTO messages (guild_id, channel_id, user_id, message_id, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [guildId, channelId, userId, messageId, content]
  );
}

export async function countMessages(channelId) {
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM messages WHERE channel_id = $1`,
    [channelId]
  );
  return r.rows[0].c;
}

export async function countStoredMessagesByChannel(channelId) {
  return countMessages(channelId);
}

export async function countStoredMessagesForGuild(guildId) {
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM messages WHERE guild_id = $1`,
    [guildId]
  );
  return r.rows[0].c;
}

/**
 * Fetch the oldest N messages for a channel without deleting them.
 * Deletion is performed only after summary persistence succeeds.
 */
export async function fetchOldestMessages(channelId, limit) {
  const r = await query(
    `SELECT id, guild_id, channel_id, message_id, user_id, content, timestamp
       FROM messages
      WHERE channel_id = $1
      ORDER BY timestamp ASC
      LIMIT $2`,
    [channelId, limit]
  );
  return r.rows;
}

export async function deleteMessagesByIds(ids) {
  if (!ids?.length) return 0;
  const r = await query(`DELETE FROM messages WHERE id = ANY($1::bigint[])`, [ids]);
  return r.rowCount ?? 0;
}

export async function fetchRecentMessages(channelId, limit) {
  const r = await query(
    `SELECT message_id, user_id, content, timestamp
       FROM messages
      WHERE channel_id = $1
      ORDER BY timestamp DESC
      LIMIT $2`,
    [channelId, limit]
  );
  return r.rows.reverse();
}

// ---------- cleanup ----------

export async function deleteOldMessages() {
  // 1. Time-based pruning for raw chat rows.
  const ageR = await query(
    `DELETE FROM messages
       WHERE timestamp < NOW() - ($1 || ' hours')::interval`,
    [String(config.limits.messageRetentionHours)]
  );

  // 2. Hard cap per channel: keep only the newest MAX_MESSAGES_PER_CHANNEL.
  const capR = await query(
    `DELETE FROM messages
       WHERE id IN (
         SELECT id FROM (
           SELECT id,
                  ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY timestamp DESC) AS rn
             FROM messages
         ) t
         WHERE t.rn > $1
       )`,
    [config.limits.maxMessagesPerChannel]
  );

  // 3. Compact long-term summaries too, so persistent storage never grows forever.
  const summaryR = await query(
    `DELETE FROM summaries
       WHERE created_at < NOW() - ($1 || ' days')::interval`,
    [String(config.limits.summaryRetentionDays)]
  );

  return {
    byAge: ageR.rowCount ?? 0,
    byCap: capR.rowCount ?? 0,
    summaries: summaryR.rowCount ?? 0,
  };
}

// ---------- summaries ----------

export async function insertSummary({
  guildId,
  channelId,
  summaryText,
  detectedTopics,
  participants,
  tone,
  highlights,
  timeRangeStart,
  timeRangeEnd,
}) {
  const r = await query(
    `INSERT INTO summaries
       (guild_id, channel_id, summary_text, detected_topics, participants, tone, highlights, time_range_start, time_range_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      guildId,
      channelId,
      summaryText,
      detectedTopics,
      participants,
      tone,
      highlights,
      timeRangeStart,
      timeRangeEnd,
    ]
  );
  return r.rows[0].id;
}

export async function fetchPastSummaries(channelId, limit = 3) {
  const r = await query(
    `SELECT summary_text, detected_topics, time_range_end
       FROM summaries
      WHERE channel_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [channelId, limit]
  );
  return r.rows.reverse();
}

// ---------- guild config ----------

export async function getGuildConfig(guildId) {
  const r = await query(
    `SELECT guild_id, enabled_channels, summary_channel_id, alert_channel_id, alert_role_id, alert_settings
       FROM guild_config
      WHERE guild_id = $1`,
    [guildId]
  );
  const row = r.rows[0];
  if (!row) return null;
  row.alert_settings = normalizeAlertSettings(row.alert_settings);
  return row;
}

async function upsertGuildConfig(guildId) {
  await query(
    `INSERT INTO guild_config (guild_id) VALUES ($1)
     ON CONFLICT (guild_id) DO NOTHING`,
    [guildId]
  );
}

export async function enableChannel(guildId, channelId) {
  await upsertGuildConfig(guildId);
  await query(
    `UPDATE guild_config
        SET enabled_channels = (
              SELECT ARRAY(SELECT DISTINCT unnest(enabled_channels || ARRAY[$2]::text[]))
            ),
            updated_at = NOW()
      WHERE guild_id = $1`,
    [guildId, channelId]
  );
  return getGuildConfig(guildId);
}

export async function disableChannel(guildId, channelId) {
  await upsertGuildConfig(guildId);
  await query(
    `UPDATE guild_config
        SET enabled_channels = array_remove(enabled_channels, $2),
            updated_at = NOW()
      WHERE guild_id = $1`,
    [guildId, channelId]
  );
  return getGuildConfig(guildId);
}

export async function setSummaryChannel(guildId, channelId) {
  await upsertGuildConfig(guildId);
  await query(
    `UPDATE guild_config
        SET summary_channel_id = $2, updated_at = NOW()
      WHERE guild_id = $1`,
    [guildId, channelId]
  );
  return getGuildConfig(guildId);
}

export async function setAlertChannel(guildId, channelId) {
  await upsertGuildConfig(guildId);
  await query(
    `UPDATE guild_config
        SET alert_channel_id = $2, updated_at = NOW()
      WHERE guild_id = $1`,
    [guildId, channelId]
  );
  return getGuildConfig(guildId);
}

export async function setAlertRole(guildId, roleId) {
  await upsertGuildConfig(guildId);
  await query(
    `UPDATE guild_config
        SET alert_role_id = $2, updated_at = NOW()
      WHERE guild_id = $1`,
    [guildId, roleId]
  );
  return getGuildConfig(guildId);
}


export async function setAlertSettings(guildId, alertSettings) {
  await upsertGuildConfig(guildId);
  const normalized = normalizeAlertSettings(alertSettings);
  await query(
    `UPDATE guild_config
        SET alert_settings = $2::jsonb, updated_at = NOW()
      WHERE guild_id = $1`,
    [guildId, JSON.stringify(normalized)]
  );
  return getGuildConfig(guildId);
}
