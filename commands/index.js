import { Collection } from 'discord.js';
import { summarize } from './summarize.js';
import { alertPanelCmd } from './alertPanel.js';
import {
  setupCmd,
  configCmd,
  statusCmd,
  testSummaryCmd,
  enableChannelCmd,
  disableChannelCmd,
  setSummaryChannelCmd,
  setAlertChannelCmd,
  setAlertRoleCmd,
} from './admin.js';

export const ALL_COMMANDS = [
  summarize,
  setupCmd,
  configCmd,
  statusCmd,
  testSummaryCmd,
  alertPanelCmd,
  enableChannelCmd,
  disableChannelCmd,
  setSummaryChannelCmd,
  setAlertChannelCmd,
  setAlertRoleCmd,
];

export function buildCommandCollection() {
  const c = new Collection();
  for (const cmd of ALL_COMMANDS) {
    c.set(cmd.data.name, cmd);
  }
  return c;
}
