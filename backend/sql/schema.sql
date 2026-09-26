CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  username       TEXT UNIQUE,
  password_hash  TEXT,
  display_name   TEXT NOT NULL DEFAULT 'XE3AGLE Trader',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  google_sub     TEXT UNIQUE,
  auth_provider  TEXT NOT NULL DEFAULT 'email',
  referrer_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safe upgrades for existing v19 databases
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_states (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state             JSONB NOT NULL DEFAULT '{}'::jsonb,
  version           BIGINT NOT NULL DEFAULT 1,
  client_modified_at BIGINT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  category   TEXT NOT NULL DEFAULT 'OTHER',
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_email  TEXT NOT NULL,
  converted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_user_states_updated ON user_states(updated_at);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;


CREATE TABLE IF NOT EXISTS media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_id    TEXT,
  filename    TEXT NOT NULL DEFAULT 'screenshot.png',
  mime_type   TEXT NOT NULL DEFAULT 'image/jpeg',
  byte_size   INT  NOT NULL DEFAULT 0,
  data_base64 TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_trade ON media(user_id, trade_id);
