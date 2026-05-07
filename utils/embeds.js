import { EmbedBuilder } from 'discord.js';
import { ALERT_TREE, MODE_META, SENSITIVITY_PRESETS, categoryModeSummary, normalizeAlertSettings, leafKey } from './alertSettings.js';

export const Colors = {
  SummaryGreen: 0x2ecc71,
  SummaryYellow: 0xf1c40f,
  SummaryRed: 0xe74c3c,
  Alert: 0xe74c3c,
  FactCheck: 0x3498db,
  Info: 0x95a5a6,
  Warn: 0xf39c12,
};

const VERDICT_META = {
  TRUE:      { icon: '✅', color: 0x2ecc71 },
  FALSE:     { icon: '❌', color: 0xe74c3c },
  UNCERTAIN: { icon: '⚠️', color: 0xf39c12 },
  NOT_APPLICABLE: { icon: '💬', color: 0x3498db },
};

const TYPE_META = {
  FACT_CLAIM: { title: '🔎 Fact Check', label: 'Factual claim' },
  QUESTION: { title: '💬 Answer', label: 'Question' },
  IDENTIFICATION_REQUEST: { title: '🧭 Identification Help', label: 'Identification request' },
  OPINION: { title: '💭 Opinion Check', label: 'Opinion / subjective' },
  JOKE_OR_SARCASM: { title: '😄 Joke / Sarcasm Check', label: 'Likely joke or sarcasm' },
  EXPLANATION_REQUEST: { title: '🧠 Explanation', label: 'Explanation' },
  NEEDS_CONTEXT: { title: '🧠 Context Check', label: 'Needs context' },
};

function summaryColor(riskLevel) {
  if (riskLevel === 'red') return Colors.SummaryRed;
  if (riskLevel === 'yellow') return Colors.SummaryYellow;
  return Colors.SummaryGreen;
}

function riskLabel(riskLevel) {
  if (riskLevel === 'red') return '🔴 Alert-level discussion';
  if (riskLevel === 'yellow') return '🟡 Slightly spicy / needs light awareness';
  return '🟢 All good';
}

function fmtList(xs, maxLen = 160) {
  if (!xs || !xs.length) return '*(none)*';
  const lines = xs.map((x) => `• ${String(x).slice(0, maxLen)}`);
  let out = '';
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line;
    if (next.length > 1000) {
      out += '\n• …';
      break;
    }
    out = next;
  }
  return out || '*(none)*';
}

function unixTs(value) {
  const d = value instanceof Date ? value : new Date(value);
  const n = Math.floor(d.getTime() / 1000);
  return Number.isFinite(n) ? n : null;
}

export function discordTimeRange(start, end) {
  const s = unixTs(start);
  const e = unixTs(end);
  if (!s || !e) return '*(unknown)*';
  return `<t:${s}:t> – <t:${e}:t>\n<t:${s}:F> – <t:${e}:F>`;
}

export function factCheckEmbed({ type = 'FACT_CLAIM', verdict, result, explanation, confidence, original }) {
  const meta = VERDICT_META[verdict] ?? VERDICT_META.UNCERTAIN;
  const typeMeta = TYPE_META[type] ?? TYPE_META.NEEDS_CONTEXT;
  const snippet = (original ?? '').slice(0, 300);
  const fields = [
    { name: 'Type', value: typeMeta.label, inline: true },
    { name: 'Confidence', value: `${Math.round(confidence ?? 0)}%`, inline: true },
  ];
  if (type === 'FACT_CLAIM') {
    fields.splice(1, 0, { name: 'Verdict', value: `${meta.icon} **${verdict || 'UNCERTAIN'}**`, inline: true });
  } else if (verdict && verdict !== 'NOT_APPLICABLE') {
    fields.splice(1, 0, { name: 'Literal Verdict', value: `${meta.icon} **${verdict}**`, inline: true });
  }
  if (result) fields.push({ name: type === 'QUESTION' ? 'Answer' : 'Result', value: result.slice(0, 900) });
  fields.push({ name: 'Explanation', value: explanation || '*(none)*' });
  return new EmbedBuilder()
    .setColor(meta.color || Colors.FactCheck)
    .setTitle(typeMeta.title)
    .setDescription(snippet ? `> ${snippet.replace(/\n/g, '\n> ')}` : null)
    .addFields(...fields)
    .setFooter({ text: 'AI-assisted response. Verify important claims independently.' })
    .setTimestamp();
}

export function summaryEmbed({ topics, participants, tone, highlights, context, riskLevel = 'green', riskReason, count, channelMention, timeRangeStart, timeRangeEnd }) {
  return new EmbedBuilder()
    .setColor(summaryColor(riskLevel))
    .setTitle('📌 Channel Summary')
    .setDescription(riskReason ? `**Status:** ${riskLabel(riskLevel)}\n${riskReason.slice(0, 250)}` : `**Status:** ${riskLabel(riskLevel)}`)
    .addFields(
      { name: 'Channel', value: channelMention || '*(unknown)*', inline: true },
      { name: 'Message Count', value: `${count ?? 'unknown'}`, inline: true },
      { name: 'Time Range', value: discordTimeRange(timeRangeStart, timeRangeEnd) },
      { name: '🗂️ Topics', value: fmtList(topics) },
      { name: '🧩 Extra Context', value: fmtList(context) },
      { name: '👥 Participants', value: fmtList(participants, 120) },
      { name: '✨ Highlights', value: fmtList(highlights) },
      { name: '🎭 Tone', value: tone || '*(unknown)*' }
    )
    .setFooter({ text: 'Auto summary. Serious mod alerts are routed separately to the configured staff channel.' })
    .setTimestamp();
}

export function privateSummaryEmbed({ topics, participants, tone, highlights, context, count }) {
  return new EmbedBuilder()
    .setColor(Colors.SummaryGreen)
    .setTitle('📌 Your Private Summary')
    .setDescription(`Last **${count}** messages. Only you can see this.`)
    .addFields(
      { name: '🗂️ Main Topics', value: fmtList(topics) },
      { name: '🧩 Helpful Context', value: fmtList(context) },
      { name: '👥 People Involved', value: fmtList(participants, 120) },
      { name: '✨ Highlights', value: fmtList(highlights) },
      { name: '🎭 Overall Tone', value: tone || '*(unknown)*' }
    )
    .setTimestamp();
}

export function alertEmbed({ categories, severity = 'red', evidence, links, channelMention, timeRangeStart, timeRangeEnd }) {
  return new EmbedBuilder()
    .setColor(Colors.Alert)
    .setTitle('⚠️ Mod Alert')
    .setDescription('A conversation segment may need moderator review.')
    .addFields(
      { name: 'Channel', value: channelMention || '*(unknown)*', inline: true },
      { name: 'Severity', value: severity === 'red' ? '🔴 Review recommended' : '🟡 Awareness only', inline: true },
      { name: 'Time Range', value: discordTimeRange(timeRangeStart, timeRangeEnd) },
      { name: 'Detected Categories', value: categories?.length ? categories.map((c) => `• **${typeof c === 'string' ? c : c.label}**${typeof c === 'object' ? ` (${c.mode})` : ''}`).join('\n') : '*(none)*' },
      { name: 'Relevant Messages', value: links?.length ? links.map((x, i) => `• [Jump ${i + 1}](${x})`).join('\n') : 'No direct jump links available.' },
      { name: 'Suggested Action', value: 'Open the linked messages, review the context, and decide whether any mod action is needed.' },
      { name: 'Short Neutral Context', value: (evidence || 'AI detected a potentially sensitive topic.').slice(0, 700) }
    )
    .setFooter({ text: 'Mod-only alert. Make sure this channel is not visible to regular members.' })
    .setTimestamp();
}

export function adminConfigEmbed({ cfg, guildName }) {
  const enabled = cfg?.enabled_channels || [];
  return new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle('⚙️ Bot Configuration')
    .setDescription(guildName ? `Current setup for **${guildName}**.` : 'Current server setup.')
    .addFields(
      { name: 'Enabled Channels', value: enabled.length ? enabled.map((id) => `• <#${id}>`).join('\n') : '*(none yet)*' },
      { name: 'Summary Channel', value: cfg?.summary_channel_id ? `<#${cfg.summary_channel_id}>` : '*(not set; falls back to source channel)*', inline: false },
      { name: 'Mod Alert Channel', value: cfg?.alert_channel_id ? `<#${cfg.alert_channel_id}>` : '*(not set; alerts are not posted publicly)*', inline: false },
      { name: 'Alert Ping Role', value: cfg?.alert_role_id ? `<@&${cfg.alert_role_id}>` : '*(not set; alerts will not ping a role)*', inline: false },
      { name: 'Alert Panel', value: 'Use `/alert_panel` to tune categories, subcategories, sub-subcategories, and sensitivity presets.', inline: false },
      { name: 'Sensitivity', value: SENSITIVITY_PRESETS[normalizeAlertSettings(cfg?.alert_settings).sensitivity] || 'Custom', inline: true }
    )
    .setTimestamp();
}

export function statusEmbed({ dbOk, aiModel, enabledCount, totalStored, currentCount, triggerCount, retentionHours, maxPerChannel }) {
  return new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle('📊 Bot Status')
    .addFields(
      { name: 'Bot', value: 'Online', inline: true },
      { name: 'Database', value: dbOk ? 'Connected' : 'Problem detected', inline: true },
      { name: 'AI Model', value: aiModel || 'Unknown', inline: false },
      { name: 'Enabled Channels', value: `${enabledCount}`, inline: true },
      { name: 'Stored Raw Messages', value: `${totalStored}`, inline: true },
      { name: 'This Channel Counter', value: `${currentCount}/${triggerCount}`, inline: true },
      { name: 'Retention', value: `Raw messages: ${retentionHours}h max, ${maxPerChannel}/channel max. Summaries are compacted separately.` }
    )
    .setTimestamp();
}


export function alertPanelOverviewEmbed({ cfg, guildName }) {
  const settings = normalizeAlertSettings(cfg?.alert_settings);
  return new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle('🛡️ Alert Panel')
    .setDescription([
      guildName ? `Configuring **${guildName}**.` : 'Configure this server.',
      `**Preset:** ${SENSITIVITY_PRESETS[settings.sensitivity] || 'Custom'}`,
      `**Alert Role:** ${cfg?.alert_role_id ? `<@&${cfg.alert_role_id}>` : 'not set'}`,
      `**Alert Channel:** ${cfg?.alert_channel_id ? `<#${cfg.alert_channel_id}>` : 'not set'}`,
      '',
      '**Mode legend:** ⬜ disabled · 🟨 summary only · 🔴 alert · 🚨 alert + role ping',
      'Choose a category below to edit subcategories and sub-subcategories. Changes save instantly.'
    ].join('\n'))
    .addFields(
      ...ALERT_TREE.slice(0, 9).map((cat) => ({
        name: cat.label,
        value: categoryModeSummary(settings, cat.key),
        inline: true,
      }))
    )
    .setFooter({ text: 'Tip: use Chill for banter-heavy servers; Bigotry and serious safety issues still stay actionable.' })
    .setTimestamp();
}

export function alertCategoryEmbed({ cfg, categoryKey }) {
  const settings = normalizeAlertSettings(cfg?.alert_settings);
  const cat = ALERT_TREE.find((c) => c.key === categoryKey) || ALERT_TREE[0];
  return new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle(`🛡️ ${cat.label}`)
    .setDescription(`${cat.description}\n\n**Mode legend:** ⬜ disabled · 🟨 summary only · 🔴 alert · 🚨 alert + role ping`)
    .addFields(
      ...cat.subcategories.map((sub) => {
        const lines = sub.leaves.map((leaf) => {
          const key = leafKey(cat.key, sub.key, leaf);
          const mode = settings.modes[key] || 'disabled';
          return `${MODE_META[mode].icon} ${leaf}`;
        });
        return { name: sub.label, value: lines.join('\n').slice(0, 1000), inline: true };
      })
    )
    .setFooter({ text: 'Open a subcategory to cycle individual sub-subcategory modes.' })
    .setTimestamp();
}

export function alertSubcategoryEmbed({ cfg, categoryKey, subKey }) {
  const settings = normalizeAlertSettings(cfg?.alert_settings);
  const cat = ALERT_TREE.find((c) => c.key === categoryKey) || ALERT_TREE[0];
  const sub = cat.subcategories.find((x) => x.key === subKey) || cat.subcategories[0];
  return new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle(`🛡️ ${cat.label} > ${sub.label}`)
    .setDescription([
      'Select one or more sub-subcategories below to cycle them:',
      '⬜ disabled → 🟨 summary only → 🔴 alert → 🚨 alert + role ping → ⬜ disabled',
    ].join('\n'))
    .addFields(
      { name: 'Current modes', value: sub.leaves.map((leaf) => {
        const key = leafKey(cat.key, sub.key, leaf);
        const mode = settings.modes[key] || 'disabled';
        return `${MODE_META[mode].icon} **${leaf}** — ${MODE_META[mode].label}`;
      }).join('\n') }
    )
    .setTimestamp();
}

export function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Colors.Warn)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description);
}

export function warnEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Colors.Warn)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description);
}
