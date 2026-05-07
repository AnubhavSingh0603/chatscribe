# Discord Summarizer Bot

A production-ready Discord bot built with **Node.js**, **discord.js v14**, and **PostgreSQL (Neon)**.

Features:

- ✅ **Fact-check** any message — reply with `!factcheck` or right-click → *Apps → Fact Check*.
- 🧠 **Auto-summarization** every 300 messages on enabled channels.
- 🔒 **Manual private summary** (`/summarize count`) — ephemeral, ≤ 100 messages.
- ⚠️ **AI trigger detection** for *sexual violence, racism, politics, religion* routed only to the configured mod-only alert channel.
- 🛡️ **Admin controls** (Administrator, Manage Server, Manage Channels, or Manage Messages required) for enabling channels and routing summary/alert outputs.
- 💾 **Minimal DB usage** — last 1000 messages or 24h per channel, hourly cleanup, summaries persist.

---

## 1. Prerequisites

- Node.js ≥ 18
- A Neon PostgreSQL database (free tier works)
- A Discord application + bot ([Discord Developer Portal](https://discord.com/developers/applications))
- An OpenAI-compatible AI API key (e.g. [Groq](https://console.groq.com), free tier — works out of the box)

---

## 2. Discord Developer Portal Setup

1. Create a **New Application** → tab **Bot** → *Add Bot*.
2. Enable **MESSAGE CONTENT INTENT**. (Server Members intent optional.)
3. Copy the **Bot Token** → `.env` as `DISCORD_TOKEN`.
4. Copy the **Application ID** → `.env` as `DISCORD_CLIENT_ID`.
5. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`, `Embed Links`, `Manage Messages` (optional)
6. Open the generated URL → invite to your server.

---

## 3. Local Setup

```bash
git clone <your-repo>
cd discord-summarizer-bot
npm install
cp .env.example .env
# Fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL, AI_API_KEY
```

Apply schema (idempotent):

```bash
npm run schema
```

Register slash commands. For instant testing in one server, set `DISCORD_DEV_GUILD_ID` in `.env`, then:

```bash
npm run deploy
```

(Leave `DISCORD_DEV_GUILD_ID` blank for global registration — propagates in up to ~1 hour.)

Run the bot:

```bash
npm start
```

---

## 4. Neon PostgreSQL Setup

1. Create a project + database in the [Neon Console](https://console.neon.tech).
2. Copy the **pooled** connection string (it includes `sslmode=require`).
3. Paste into `.env` as `DATABASE_URL`.
4. The bot calls `initSchema()` on startup, but you can also run `npm run schema` manually.

---

## 5. AI Provider

The AI layer is OpenAI-compatible. Defaults are set for **Groq** (free, fast):

```
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
```

To switch providers, just change those two values:

| Provider     | `AI_BASE_URL`                                | Example `AI_MODEL`            |
| ------------ | -------------------------------------------- | ----------------------------- |
| Groq         | `https://api.groq.com/openai/v1`             | `llama-3.3-70b-versatile`     |
| OpenAI       | `https://api.openai.com/v1`                  | `gpt-4o-mini`                 |
| Together AI  | `https://api.together.xyz/v1`                | `meta-llama/Llama-3-70b-chat` |
| OpenRouter   | `https://openrouter.ai/api/v1`               | any supported model           |

The client uses `response_format: { type: "json_object" }` and tolerates fenced output for providers that ignore the flag.

---

## 6. Oracle Cloud Deployment (Always-Free)

1. Create an Ubuntu VM (Always-Free shape works fine).
2. SSH in and install Node:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
3. Clone + install:
   ```bash
   git clone <your-repo>
   cd discord-summarizer-bot
   npm ci
   cp .env.example .env && nano .env   # paste real values
   npm run schema
   npm run deploy
   ```
4. Run forever with **PM2**:
   ```bash
   sudo npm install -g pm2
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup            # follow the printed sudo command
   ```
5. Tail logs:
   ```bash
   pm2 logs discord-summarizer-bot
   ```

---

## 7. Commands

| Command                              | Who      | Behaviour                                                      |
| ------------------------------------ | -------- | -------------------------------------------------------------- |
| Reply with `!factcheck`              | anyone   | Fact-checks the replied-to message (10s cooldown per user)      |
| Right-click message → **Fact Check** | anyone   | Same as above, no typing required                              |
| `/summarize count:<1-100>`           | anyone   | Private (ephemeral) summary of last *N* messages               |
| `/setup`                           | Mods     | Shows guided setup checklist                                    |
| `/config`                          | Mods     | Shows current enabled/routing configuration                    |
| `/status`                          | Mods     | Shows DB health and counters                                    |
| `/test_summary`                    | Mods     | Previews summary style privately                                |
| `/enable_channel [channel]`          | Mods     | Turn on auto-summary for a channel                             |
| `/disable_channel [channel]`         | Mods     | Turn it back off                                               |
| `/set_summary_channel channel:`      | Mods     | Where auto-summary embeds get posted                           |
| `/set_alert_channel channel:`        | Mods     | Where trigger alerts get posted (set to staff-only channel)  |

Mod commands are runtime-locked to Administrator, Manage Server, Manage Channels, or Manage Messages. Regular members receive an ephemeral permission error.

---

## 8. How Storage Stays Small

- Only **enabled channels** store messages.
- Each insert keeps **only text** (no embeds, attachments, or metadata).
- Cleanup job (hourly, configurable) runs two passes:
  1. Delete rows older than `MESSAGE_RETENTION_HOURS` (default 24).
  2. Per channel, keep only the newest `MAX_MESSAGES_PER_CHANNEL` (default 1000).
- When a channel hits 300 stored messages, it is **summarized + saved first**, then the processed raw rows are deleted only after AI summary persistence succeeds.
- Summaries are persisted compactly and reused as **context** for future summaries (summary stitching).

---

## 9. Tunables

All in `.env` (with sensible defaults):

```
SUMMARY_TRIGGER_COUNT=300
MAX_MESSAGES_PER_CHANNEL=1000
MESSAGE_RETENTION_HOURS=24
CLEANUP_INTERVAL_MINUTES=60
FACTCHECK_COOLDOWN_SECONDS=10
MESSAGE_STORE_CHAR_LIMIT=1200
SUMMARY_RETENTION_DAYS=90
```

---

## 10. Project Structure

```
discord-summarizer-bot/
├── index.js                  # entry point
├── deploy-commands.js        # register slash + context commands
├── config.js                 # env parsing + tunables
├── ecosystem.config.cjs      # PM2 config
├── ai/
│   ├── client.js             # OpenAI-compatible HTTP + retry + JSON parse
│   └── tasks.js              # factcheck / summarize / trigger detection
├── commands/
│   ├── index.js              # registry
│   ├── factcheck.js          # optional right-click context menu
│   ├── summarize.js          # /summarize
│   └── admin.js              # /enable_channel, /disable_channel, /set_*
├── db/
│   ├── pool.js               # pg pool
│   ├── schema.sql            # tables + indexes
│   ├── init.js               # idempotent schema apply
│   └── queries.js            # all SQL functions
├── handlers/
│   ├── ready.js
│   ├── messageCreate.js      # store + maybe trigger summarize
│   ├── interactionCreate.js  # command dispatch
│   └── summarizer.js         # the 300-message pipeline
├── jobs/
│   └── cleanup.js            # hourly retention + cap pruning
└── utils/
    ├── cache.js              # guild config cache
    ├── cooldowns.js
    ├── embeds.js
    └── logger.js
```

---

## 11. Troubleshooting

- **Slash commands missing** → run `npm run deploy`. Set `DISCORD_DEV_GUILD_ID` for instant registration.
- **`Missing Access` on AI calls** → wrong `AI_BASE_URL` or invalid key. Check provider dashboard.
- **`SSL/TLS required`** in DB logs → Neon URL must include `?sslmode=require`.
- **No summaries appearing** → confirm the channel is enabled (`/enable_channel`) and that 300 non-bot text messages have been posted *after* enabling.

---

## 12. Disposable Local Tests

A safe offline test folder is included:

```bash
node local_system_disposable_tests/run_local_tests.cjs
```

This does not call Discord, Groq, Neon, or Oracle. It creates only a fake local JSON database inside the test folder. The entire `local_system_disposable_tests/` folder can be deleted without affecting the bot.

---

## 13. Beginner Setup Guide and Name Ideas

Additional included files:

- `BEGINNER_SETUP_GUIDE.md` — step-by-step setup from Discord Developer Portal → Groq → Neon → Oracle.
- `BOT_NAME_IDEAS.md` — suggested bot names.

## Latest moderation/UX updates

- `/set_alert_role role:@Mods` lets staff choose a role to ping on red-level mod alerts.
- Public auto summaries are color-coded:
  - green = all good
  - yellow = slightly spicy/risky, usually awareness only
  - red = alert-level discussion
- NSFW/flirty banter can be summarized normally; it is not treated as an automatic mod alert unless the AI sees malicious escalation, coercion, harassment, threats, hate, or other serious risk.
- Auto summaries now include an extra context section for more useful logs.
- Mod alerts include up to five jump links to relevant messages when available.
- Auto summary participant names are resolved from Discord member display names where possible, so public logs avoid raw user IDs and avoid pinging members.
- Alerts are posted only to the configured mod alert channel. The optional alert role ping is sent with restricted allowed mentions.

After pulling this update on the VM, run:

```bash
npm run schema
npm run deploy
pm2 restart chatscribe --update-env
```

If the alert role does not ping, make sure the bot has permission to mention the role or make the role mentionable.

---

## Latest Alert Panel + Reply Inspector Update

### Interactive alert configuration

Use `/alert_panel` to open a private moderator-only configuration panel. It replaces long slash-command chains with a Discord UI made from dropdowns and buttons.

Alert rules are now hierarchical:

```text
Category → Subcategory → Sub-subcategory
```

Each sub-subcategory can be set to one of four modes:

```text
⬜ Disabled       = ignored for alerts
🟨 Summary only   = may color summaries yellow, never pings mods
🔴 Mod alert      = sends a mod-channel alert, no role ping
🚨 Alert + ping   = sends a mod alert and pings the configured alert role
```

The panel includes sensitivity presets:

```text
🟢 Chill Server       = best for banter-heavy servers
🟡 Balanced           = default community moderation
🔴 Strict Moderation  = more sensitive public-server style moderation
🛠 Custom             = any manual edits through the panel
```

Recommended flow for a new server:

```text
/setup
/set_summary_channel channel:#summary-logs
/set_alert_channel channel:#mod-alerts
/set_alert_role role:@Mods
/enable_channel channel:#general
/alert_panel
/test_summary
/config
/status
```

### Default moderation philosophy

ChatScribe should alert for actionable moderation concerns, not every sensitive word.

Examples:

```text
Flirty/NSFW banter                    → usually 🟨 summary only
Meme self-harm phrase                 → usually 🟨 summary only
Gaming/playful violence               → usually 🟨 summary only
Bigotry / targeted harassment         → usually 🔴 alert
Doxxing / scams / credible threats    → usually 🚨 alert + ping
Minor sexual safety / imminent harm   → usually 🚨 alert + ping
Long hostile fights / dogpiles        → configurable; usually 🔴 alert when sustained
```

### Updated `!factcheck`

`!factcheck` now acts as a reply-based AI helper, not only a true/false checker.

Supported aliases:

```text
!factcheck
!fc
!check
!explain
```

When used as a reply, it classifies the target message as one of:

```text
FACT_CLAIM
QUESTION
IDENTIFICATION_REQUEST
OPINION
JOKE_OR_SARCASM
EXPLANATION_REQUEST
NEEDS_CONTEXT
```

So if a member replies to a question with `!factcheck`, ChatScribe answers it. If they reply to a joke, it identifies the joke/sarcasm. If they use `!explain`, it explains the replied message in simpler terms.

### Updated command list

| Command / UI | Who | Purpose |
| --- | --- | --- |
| `/alert_panel` | Mods | Interactive alert category/subcategory/sub-subcategory config |
| `/setup` | Mods | Guided setup checklist |
| `/config` | Mods | Shows channels, alert role, and alert-panel reminder |
| `/status` | Mods | Shows bot/DB/AI/storage health |
| `/set_summary_channel` | Mods | Sets public auto-summary channel |
| `/set_alert_channel` | Mods | Sets mod-only alert channel |
| `/set_alert_role` | Mods | Sets role pinged by 🚨 alert rules |
| `/enable_channel` | Mods | Enables monitored channel |
| `/disable_channel` | Mods | Disables monitored channel |
| `/test_summary` | Mods | Private summary preview |
| `/summarize count:1-100` | Members | Private user-friendly summary, no trigger warnings |
| `!factcheck`, `!fc`, `!check`, `!explain` | Members | Reply-based fact-check, answer, ID help, opinion/joke/explanation helper |
