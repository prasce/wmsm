-- Migration 001: Add users table
-- Password storage: bcrypt( SHA256(plaintext) )

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL       PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  display_name  VARCHAR(100) NOT NULL DEFAULT '',
  role          VARCHAR(20)  NOT NULL DEFAULT 'operator'
                             CHECK (role IN ('admin','operator','viewer')),
  password_hash VARCHAR(255) NOT NULL,
  email         VARCHAR(150) UNIQUE,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users                IS '系統使用者帳號';
COMMENT ON COLUMN users.password_hash  IS 'bcrypt(SHA256(plaintext)) — SHA256 first to bypass 72-byte bcrypt limit';
COMMENT ON COLUMN users.role           IS 'admin | operator | viewer';

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active   ON users(active);
