-- Add options column to user_plans table
-- Phase 1 MVP: プラン契約時にオプションを選択できるようにする

-- ============================================
-- user_plansテーブルにoptionsカラムを追加
-- ============================================
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;

-- オプションの構造例:
-- {
--   "company_registration": true,  // 法人登記（+5,500円/月）
--   "printer": true,                // プリンター（+1,100円/月）
--   "twenty_four_hours": true,      // 24時間利用（+5,500円/月）
--   "fixed_seat": true,             // 固定席化（+23,100円/月）
--   "locker": true                  // ロッカー（料金要確認）
-- }

-- インデックス（オプション検索用）
CREATE INDEX IF NOT EXISTS idx_user_plans_options ON user_plans USING GIN (options);

-- コメント追加
COMMENT ON COLUMN user_plans.options IS 'プラン契約時のオプション情報（JSONB形式）';

