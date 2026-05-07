import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import {
  enableChannel,
  disableChannel,
  setSummaryChannel,
  setAlertChannel,
  setAlertRole,
  getGuildConfig,
  countStoredMessagesForGuild,
  countStoredMessagesByChannel,
} from '../db/queries.js';
import { query } from '../db/pool.js';
import { setGuildConfig, invalidateGuildConfig } from '../utils/cache.js';
import { infoEmbed, errorEmbed, adminConfigEmbed, statusEmbed, privateSummaryEmbed } from '../utils/embeds.js';
import { aiSummarize } from '../ai/tasks.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const MOD_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
];

const MOD_COMMAND_VISIBILITY_PERMISSION = PermissionFlagsBits.ManageMessages;

function adminGuard(commandData) {
  // Discord command visibility cannot express "any of these mod permissions" reliably.
  // Use Manage Messages as the default visibility gate so normal members do not see
  // staff commands. The runtime guard below still accepts the broader mod permission set.
  return commandData
    .setDefaultMemberPermissions(MOD_COMMAND_VISIBILITY_PERMISSION)
    .setDMPermission(false);
}

function hasModPermission(interaction) {
  return MOD_PERMS.some((p) => interaction.memberPermissions?.has(p));
}

async function safeRun(interaction, work) {
  try {
    if (!hasModPermission(interaction)) {
      await interaction.reply({
        embeds: [errorEmbed('Permission required', 'You need moderator permissions to use this command.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await work();
  } catch (err) {
    logger.error('admin command failed:', err);
    const payload = {
      embeds: [errorEmbed('Command failed', 'Something went wrong. Please try again.')],
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}

// ---- /setup ----
export const setupCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Show a guided setup checklist for this bot.')
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      await interaction.reply({
        embeds: [
          infoEmbed(
            '🧭 Bot setup checklist',
            [
              '**1. Enable channels** with `/enable_channel` in each channel you want summarized.',
              '**2. Set a summary channel** with `/set_summary_channel`.',
              '**3. Set a mod-only alert channel** with `/set_alert_channel`.',
              '**4. Optional: set a mod ping role** with `/set_alert_role` so alerts notify staff.',
              '**5. Tune alert rules** with `/alert_panel` (checkbox-style UI for categories/subcategories).',
              '**6. Test the style** with `/test_summary`.',
              '**7. Check config anytime** with `/config` or health with `/status`.',
              '',
              'Members can use `!factcheck`, `!fc`, `!check`, or `!explain` by replying to a message, and `/summarise count:<1-100>` for private summaries. Staff-only commands are hidden from regular members by Discord permission defaults and also checked at runtime.',
            ].join('\n')
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

// ---- /config ----
export const configCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('config')
      .setDescription('Show the current server configuration for summaries and alerts.')
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      const cfg = await getGuildConfig(interaction.guildId);
      await interaction.reply({
        embeds: [adminConfigEmbed({ cfg, guildName: interaction.guild?.name })],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

// ---- /status ----
export const statusCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Show bot health, DB status, and current message counters.')
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let dbOk = false;
      try {
        await query('SELECT 1');
        dbOk = true;
      } catch (err) {
        logger.error('status db check failed:', err);
      }
      const cfg = await getGuildConfig(interaction.guildId);
      const enabled = cfg?.enabled_channels || [];
      const totalStored = await countStoredMessagesForGuild(interaction.guildId);
      const currentCount = await countStoredMessagesByChannel(interaction.channelId).catch(() => 0);
      await interaction.editReply({
        embeds: [
          statusEmbed({
            dbOk,
            aiModel: config.ai.model,
            enabledCount: enabled.length,
            totalStored,
            currentCount,
            triggerCount: config.limits.summaryTriggerCount,
            retentionHours: config.limits.messageRetentionHours,
            maxPerChannel: config.limits.maxMessagesPerChannel,
          }),
        ],
      });
    });
  },
};

// ---- /test_summary ----
export const testSummaryCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('test_summary')
      .setDescription('Preview the summary embed using recent messages from this channel.')
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const fetched = await interaction.channel.messages.fetch({ limit: 30 });
      const messages = [...fetched.values()]
        .filter((m) => !m.author.bot && m.content?.trim())
        .reverse()
        .slice(-20)
        .map((m) => ({ username: m.author.displayName || m.author.username, content: m.content }));

      if (messages.length < 2) {
        await interaction.editReply({
          embeds: [errorEmbed('Not enough messages', 'I need at least 2 recent non-bot text messages to test the summary style.')],
        });
        return;
      }

      const result = await aiSummarize({ messages });
      await interaction.editReply({
        embeds: [privateSummaryEmbed({ ...result, count: messages.length })],
      });
    });
  },
};

// ---- /enable_channel ----
export const enableChannelCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('enable_channel')
      .setDescription('Enable automatic summarization for a channel.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel to enable (defaults to current)')
          .addChannelTypes(ChannelType.GuildText)
      )
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const cfg = await enableChannel(interaction.guildId, channel.id);
      setGuildConfig(interaction.guildId, cfg);
      await interaction.reply({
        embeds: [infoEmbed('✅ Channel enabled', `Automatic summaries are now enabled for ${channel}.`)],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

// ---- /disable_channel ----
export const disableChannelCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('disable_channel')
      .setDescription('Disable automatic summarization for a channel.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel to disable (defaults to current)')
          .addChannelTypes(ChannelType.GuildText)
      )
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const cfg = await disableChannel(interaction.guildId, channel.id);
      setGuildConfig(interaction.guildId, cfg);
      await interaction.reply({
        embeds: [infoEmbed('✅ Channel disabled', `Automatic summaries are now disabled for ${channel}.`)],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

// ---- /set_summary_channel ----
export const setSummaryChannelCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('set_summary_channel')
      .setDescription('Set the channel where auto-summaries are posted.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Target text channel')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      const channel = interaction.options.getChannel('channel', true);
      const cfg = await setSummaryChannel(interaction.guildId, channel.id);
      setGuildConfig(interaction.guildId, cfg);
      await interaction.reply({
        embeds: [infoEmbed('✅ Summary channel set', `Summaries will be posted to ${channel}.`)],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

// ---- /set_alert_channel ----
export const setAlertChannelCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('set_alert_channel')
      .setDescription('Set the mod-only channel where trigger alerts are posted.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Target staff/mod text channel')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      const channel = interaction.options.getChannel('channel', true);
      const cfg = await setAlertChannel(interaction.guildId, channel.id);
      setGuildConfig(interaction.guildId, cfg);
      await interaction.reply({
        embeds: [infoEmbed('✅ Alert channel set', `Mod alerts will be posted to ${channel}. Make sure regular members cannot view it.`)],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};


// ---- /set_alert_role ----
export const setAlertRoleCmd = {
  data: adminGuard(
    new SlashCommandBuilder()
      .setName('set_alert_role')
      .setDescription('Set the moderator role to ping when red-level alerts are posted.')
      .addRoleOption((o) =>
        o
          .setName('role')
          .setDescription('Role to ping for mod alerts')
          .setRequired(true)
      )
  ),
  async execute(interaction) {
    await safeRun(interaction, async () => {
      const role = interaction.options.getRole('role', true);
      const cfg = await setAlertRole(interaction.guildId, role.id);
      setGuildConfig(interaction.guildId, cfg);
      await interaction.reply({
        embeds: [infoEmbed('✅ Alert role set', `Red-level mod alerts will ping ${role}. Make sure the bot can mention this role.`)],
        flags: MessageFlags.Ephemeral,
      });
    });
  },
};

export { invalidateGuildConfig };
