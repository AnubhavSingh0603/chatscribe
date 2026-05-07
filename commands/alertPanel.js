import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getGuildConfig, setAlertSettings } from '../db/queries.js';
import { setGuildConfig } from '../utils/cache.js';
import { errorEmbed, alertPanelOverviewEmbed, alertCategoryEmbed, alertSubcategoryEmbed } from '../utils/embeds.js';
import {
  ALERT_TREE,
  ALERT_MODES,
  MODE_META,
  SENSITIVITY_PRESETS,
  getCategory,
  getSubcategory,
  leafKey,
  normalizeAlertSettings,
  setCategoryMode,
  setSubcategoryMode,
  cycleLeafMode,
  applyPreset,
} from '../utils/alertSettings.js';
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

function hasModPermission(interaction) {
  return MOD_PERMS.some((p) => interaction.memberPermissions?.has(p));
}

const MOD_COMMAND_VISIBILITY_PERMISSION = PermissionFlagsBits.ManageMessages;

function guardData(data) {
  // Hide the panel from regular members at Discord's command-discovery layer.
  // Runtime interactions still allow the broader MOD_PERMS set if command access is
  // granted to a mod role through Server Settings -> Integrations.
  return data
    .setDefaultMemberPermissions(MOD_COMMAND_VISIBILITY_PERMISSION)
    .setDMPermission(false);
}

export const alertPanelCmd = {
  data: guardData(
    new SlashCommandBuilder()
      .setName('alert_panel')
      .setDescription('Open an interactive UI to configure alert categories and subcategories.')
  ),
  async execute(interaction) {
    if (!hasModPermission(interaction)) {
      await interaction.reply({ embeds: [errorEmbed('Permission required', 'You need moderator permissions to use this command.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const cfg = await getGuildConfig(interaction.guildId);
    await interaction.reply({
      embeds: [alertPanelOverviewEmbed({ cfg, guildName: interaction.guild?.name })],
      components: overviewComponents(),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export async function handleAlertPanelInteraction(interaction) {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return false;
  if (!interaction.customId.startsWith('alertpanel:')) return false;

  if (!hasModPermission(interaction)) {
    await interaction.reply({ embeds: [errorEmbed('Permission required', 'You need moderator permissions to use this panel.')], flags: MessageFlags.Ephemeral });
    return true;
  }

  try {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    let cfg = await getGuildConfig(interaction.guildId);

    if (interaction.isStringSelectMenu()) {
      if (action === 'preset') {
        const preset = interaction.values[0];
        cfg = await setAlertSettings(interaction.guildId, applyPreset(preset));
        setGuildConfig(interaction.guildId, cfg);
        await interaction.update({ embeds: [alertPanelOverviewEmbed({ cfg, guildName: interaction.guild?.name })], components: overviewComponents() });
        return true;
      }
      if (action === 'category') {
        const categoryKey = interaction.values[0];
        await interaction.update({ embeds: [alertCategoryEmbed({ cfg, categoryKey })], components: categoryComponents(categoryKey) });
        return true;
      }
      if (action === 'subcategory') {
        const categoryKey = parts[2];
        const subKey = interaction.values[0];
        await interaction.update({ embeds: [alertSubcategoryEmbed({ cfg, categoryKey, subKey })], components: subcategoryComponents(categoryKey, subKey, cfg) });
        return true;
      }
      if (action === 'cycleleaf') {
        const categoryKey = parts[2];
        const subKey = parts[3];
        const settings = normalizeAlertSettings(cfg?.alert_settings);
        const next = cycleLeafMode(settings, interaction.values);
        cfg = await setAlertSettings(interaction.guildId, next);
        setGuildConfig(interaction.guildId, cfg);
        await interaction.update({ embeds: [alertSubcategoryEmbed({ cfg, categoryKey, subKey })], components: subcategoryComponents(categoryKey, subKey, cfg) });
        return true;
      }
    }

    if (interaction.isButton()) {
      if (action === 'home') {
        await interaction.update({ embeds: [alertPanelOverviewEmbed({ cfg, guildName: interaction.guild?.name })], components: overviewComponents() });
        return true;
      }
      if (action === 'category') {
        const categoryKey = parts[2];
        await interaction.update({ embeds: [alertCategoryEmbed({ cfg, categoryKey })], components: categoryComponents(categoryKey) });
        return true;
      }
      if (action === 'catmode') {
        const [, , categoryKey, mode] = parts;
        cfg = await setAlertSettings(interaction.guildId, setCategoryMode(cfg?.alert_settings, categoryKey, mode));
        setGuildConfig(interaction.guildId, cfg);
        await interaction.update({ embeds: [alertCategoryEmbed({ cfg, categoryKey })], components: categoryComponents(categoryKey) });
        return true;
      }
      if (action === 'submode') {
        const [, , categoryKey, subKey, mode] = parts;
        cfg = await setAlertSettings(interaction.guildId, setSubcategoryMode(cfg?.alert_settings, categoryKey, subKey, mode));
        setGuildConfig(interaction.guildId, cfg);
        await interaction.update({ embeds: [alertSubcategoryEmbed({ cfg, categoryKey, subKey })], components: subcategoryComponents(categoryKey, subKey, cfg) });
        return true;
      }
      if (action === 'openSub') {
        const [, , categoryKey, subKey] = parts;
        await interaction.update({ embeds: [alertSubcategoryEmbed({ cfg, categoryKey, subKey })], components: subcategoryComponents(categoryKey, subKey, cfg) });
        return true;
      }
    }
  } catch (err) {
    logger.error('alert panel interaction failed:', err);
    const payload = { embeds: [errorEmbed('Panel failed', 'Something went wrong while updating the alert panel.')], flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
    return true;
  }

  return true;
}

function overviewComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('alertpanel:category')
        .setPlaceholder('Choose a category to configure')
        .addOptions(ALERT_TREE.map((cat) => ({ label: cat.label, value: cat.key, description: cat.description.slice(0, 95) })))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('alertpanel:preset')
        .setPlaceholder('Apply a sensitivity preset')
        .addOptions(Object.entries(SENSITIVITY_PRESETS).filter(([k]) => k !== 'custom').map(([key, label]) => ({ label, value: key })))
    ),
  ];
}

function categoryComponents(categoryKey) {
  const cat = getCategory(categoryKey);
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`alertpanel:subcategory:${cat.key}`)
        .setPlaceholder(`Open a ${cat.label} subcategory`)
        .addOptions(cat.subcategories.slice(0, 25).map((sub) => ({ label: sub.label, value: sub.key })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`alertpanel:catmode:${cat.key}:disabled`).setStyle(ButtonStyle.Secondary).setLabel('Disable All'),
      new ButtonBuilder().setCustomId(`alertpanel:catmode:${cat.key}:summary`).setStyle(ButtonStyle.Primary).setLabel('Summary Only'),
      new ButtonBuilder().setCustomId(`alertpanel:catmode:${cat.key}:alert`).setStyle(ButtonStyle.Danger).setLabel('Alert All'),
      new ButtonBuilder().setCustomId(`alertpanel:catmode:${cat.key}:ping`).setStyle(ButtonStyle.Danger).setLabel('Ping All'),
      new ButtonBuilder().setCustomId('alertpanel:home').setStyle(ButtonStyle.Secondary).setLabel('Back')
    ),
  ];
}

function subcategoryComponents(categoryKey, subKey, cfg) {
  const cat = getCategory(categoryKey);
  const sub = getSubcategory(categoryKey, subKey);
  const settings = normalizeAlertSettings(cfg?.alert_settings);
  const leafOptions = sub.leaves.slice(0, 25).map((leaf) => {
    const key = leafKey(cat.key, sub.key, leaf);
    const mode = settings.modes[key] || 'disabled';
    return { label: `${MODE_META[mode].icon} ${leaf}`.slice(0, 100), value: key, description: `Currently: ${MODE_META[mode].label}. Select to cycle.`.slice(0, 100) };
  });
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`alertpanel:cycleleaf:${cat.key}:${sub.key}`)
        .setPlaceholder('Select sub-subcategories to cycle their mode')
        .setMinValues(1)
        .setMaxValues(Math.max(1, leafOptions.length))
        .addOptions(leafOptions)
    ),
    new ActionRowBuilder().addComponents(
      ...ALERT_MODES.map((mode) => new ButtonBuilder().setCustomId(`alertpanel:submode:${cat.key}:${sub.key}:${mode}`).setStyle(mode === 'disabled' ? ButtonStyle.Secondary : mode === 'summary' ? ButtonStyle.Primary : ButtonStyle.Danger).setLabel(`${MODE_META[mode].icon} ${MODE_META[mode].label}`)).slice(0, 4),
      new ButtonBuilder().setCustomId(`alertpanel:category:${cat.key}`).setStyle(ButtonStyle.Secondary).setLabel('Back')
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('alertpanel:home').setStyle(ButtonStyle.Secondary).setLabel('Panel Home')
    ),
  ];
}
