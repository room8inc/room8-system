-- Allow NULL for member_type in users table and set default to 'dropin'
-- アカウント作成時はmember_type='dropin'（非会員）をデフォルトとする
-- プラン契約時に'regular'に更新、解除時に'dropin'に戻す

-- ============================================
-- member_type を NULL 許可に変更し、デフォルト値を 'dropin' に設定
-- ============================================
ALTER TABLE users
  ALTER COLUMN member_type DROP NOT NULL,
  ALTER COLUMN member_type SET DEFAULT 'dropin',
  DROP CONSTRAINT IF EXISTS users_member_type_check,
  ADD CONSTRAINT users_member_type_check CHECK (member_type IS NULL OR member_type IN ('regular', 'dropin', 'guest'));

-- 既存のデータでNULLの場合は、'dropin'に更新
UPDATE users SET member_type = 'dropin' WHERE member_type IS NULL;

