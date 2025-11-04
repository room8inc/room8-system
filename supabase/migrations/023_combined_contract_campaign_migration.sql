-- 統合マイグレーション: 契約機能とキャンペーン機能のためのテーブル・カラム追加
-- このファイルをSupabaseのSQLエディタで実行してください

-- ============================================
-- 1. user_plansテーブルに契約期間と支払い方法を追加
-- ============================================
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS contract_term TEXT CHECK (contract_term IN ('monthly', 'yearly')) DEFAULT 'monthly';

ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('monthly', 'annual_prepaid')) DEFAULT 'monthly';

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_user_plans_contract_term ON user_plans(contract_term);
CREATE INDEX IF NOT EXISTS idx_user_plans_payment_method ON user_plans(payment_method);

-- コメント追加
COMMENT ON COLUMN user_plans.contract_term IS '契約期間: monthly（月契約）またはyearly（年契約）';
COMMENT ON COLUMN user_plans.payment_method IS '支払い方法: monthly（月払い）またはannual_prepaid（年一括前払い）';

-- ============================================
-- 2. campaigns テーブルの作成
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
-- 3. user_plansテーブルにキャンペーン情報を追加
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

-- ============================================
-- 4. campaigns テーブルのRLSポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow public to read active campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow admins to manage all campaigns" ON campaigns;

-- ポリシー1: 認証済みユーザーは有効なキャンペーンを読み取れる
CREATE POLICY "Allow public to read active campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (is_active = true AND (ended_at IS NULL OR ended_at >= CURRENT_DATE));

-- ポリシー2: 管理者は全キャンペーンを管理できる
CREATE POLICY "Allow admins to manage all campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

