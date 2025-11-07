-- ============================================
-- Auth.js用テーブル (D1/SQLite版)
-- ============================================

-- accounts (OAuth/認証プロバイダー情報)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- sessions (セッション管理)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_token ON sessions(session_token);

-- verification_tokens (メール認証トークン)
CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);

-- usersテーブルにAuth.js用カラムを追加
-- email_verified (メール認証済みフラグ)
-- image (プロフィール画像URL)
ALTER TABLE users ADD COLUMN email_verified TEXT;
ALTER TABLE users ADD COLUMN image TEXT;

