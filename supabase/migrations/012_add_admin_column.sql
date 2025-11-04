-- Add is_admin column to users table
-- Phase 1 MVP: 管理者権限の追加

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Index for admin users
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;

-- 注意: 既存のユーザーを管理者にする場合は、手動でUPDATEしてください
-- UPDATE users SET is_admin = true WHERE email = 'admin@example.com';

