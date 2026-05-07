-- ===========================================
-- ChatScribe — Schema
-- Minimal-storage design, Postgres / Neon
-- ===========================================

CREATE TABLE IF NOT EXISTS messages (
    id           BIGSERIAL PRIMARY KEY,
    message_id   TEXT,
    channel_id   TEXT        NOT NULL,
    guild_id     TEXT        NOT NULL,
    user_id      TEXT        NOT NULL,
    content      TEXT        NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatible migration for older installs that had username but no message_id.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_id TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'username'
  ) THEN
    ALTER TABLE messages ALTER COLUMN username DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_channel_time
    ON messages (channel_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_messages_timestamp
    ON messages (timestamp);

CREATE INDEX IF NOT EXISTS idx_messages_message_id
    ON messages (message_id);

-- ----------------------------------------------------

CREATE TABLE IF NOT EXISTS summaries (
    id               BIGSERIAL PRIMARY KEY,
    guild_id         TEXT        NOT NULL,
    channel_id       TEXT        NOT NULL,
    summary_text     TEXT        NOT NULL,
    detected_topics  TEXT[]      NOT NULL DEFAULT '{}',
    participants     TEXT[]      NOT NULL DEFAULT '{}',
    tone             TEXT,
    highlights       TEXT[]      NOT NULL DEFAULT '{}',
    time_range_start TIMESTAMPTZ NOT NULL,
    time_range_end   TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summaries_channel_time
    ON summaries (channel_id, created_at DESC);

-- ----------------------------------------------------

CREATE TABLE IF NOT EXISTS guild_config (
    guild_id            TEXT PRIMARY KEY,
    enabled_channels    TEXT[]      NOT NULL DEFAULT '{}',
    summary_channel_id  TEXT,
    alert_channel_id    TEXT,
    alert_role_id       TEXT,
    alert_settings      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS alert_role_id TEXT;
ALTER TABLE guild_config ADD COLUMN IF NOT EXISTS alert_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
