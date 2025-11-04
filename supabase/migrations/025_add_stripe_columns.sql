-- Add Stripe related columns to user_plans and users tables
-- Phase 2: 決済機能実装のためのStripe関連カラム追加

-- ============================================
-- usersテーブルにStripe Customer IDを追加
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe Customer ID（決済管理用）';

-- ============================================
-- user_plansテーブルにStripe関連カラムを追加
-- ============================================
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_payment_intent_id ON user_plans(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_subscription_id ON user_plans(stripe_subscription_id);

COMMENT ON COLUMN user_plans.stripe_payment_intent_id IS 'Stripe Payment Intent ID（初回決済用）';
COMMENT ON COLUMN user_plans.stripe_subscription_id IS 'Stripe Subscription ID（定期課金用）';

