-- Create campaigns table for managing promotional campaigns
-- Phase 1 MVP: キャンペーン管理機能

-- ============================================
-- campaigns テーブルの作成
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN (
    'entry_fee_50off',    -- 入会金50%OFF
    'entry_fee_free',     -- 入会金無料
    'first_month_free',   -- 初月会費無料
    'entry_fee_custom'    -- 入会金カスタム割引（拡張用）
  )),
  discount_rate INTEGER,  -- 割引率（0-100、entry_fee_custom用）
  applicable_plan_ids UUID[],  -- 適用可能なプランIDの配列（空の場合は全プラン適用）
  started_at DATE NOT NULL,
  ended_at DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(started_at, ended_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_dates ON campaigns(is_active, started_at, ended_at) WHERE is_active = true;

-- コメント追加
COMMENT ON TABLE campaigns IS 'キャンペーン情報テーブル';
COMMENT ON COLUMN campaigns.campaign_type IS 'キャンペーン種類: entry_fee_50off, entry_fee_free, first_month_free, entry_fee_custom';
COMMENT ON COLUMN campaigns.applicable_plan_ids IS '適用可能なプランIDの配列（空の場合は全プラン適用）';
COMMENT ON COLUMN campaigns.discount_rate IS '割引率（0-100、entry_fee_custom用）';

-- ============================================
-- user_plansテーブルにキャンペーン情報を追加
-- ============================================
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS entry_fee INTEGER DEFAULT 11000; -- 入会金（通常11,000円）

ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS entry_fee_discount INTEGER DEFAULT 0; -- 入会金割引額

ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS first_month_free BOOLEAN DEFAULT false; -- 初月会費無料フラグ

CREATE INDEX IF NOT EXISTS idx_user_plans_campaign_id ON user_plans(campaign_id);

-- コメント追加
COMMENT ON COLUMN user_plans.entry_fee IS '入会金（通常11,000円）';
COMMENT ON COLUMN user_plans.entry_fee_discount IS '入会金割引額';
COMMENT ON COLUMN user_plans.first_month_free IS '初月会費無料フラグ';

