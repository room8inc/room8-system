-- Add is_admin column to users table
-- Phase 1 MVP: 管理者権限の追加

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Index for admin users
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;

-- 管理者ユーザーを設定
-- 指定されたメールアドレス（k_tsuruta@room8.co.jp）を管理者に設定
UPDATE users SET is_admin = true WHERE email = 'k_tsuruta@room8.co.jp';

-- 注意: ユーザーがまだ存在しない場合は、後にユーザー登録後に実行してください
-- UPDATE users SET is_admin = true WHERE email = 'k_tsuruta@room8.co.jp';

