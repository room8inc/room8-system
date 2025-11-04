-- Add contract term and payment method to user_plans table
-- Phase 1 MVP: 長期契約割引と年一括前払い割引の対応

-- ============================================
-- user_plansテーブルに契約期間と支払い方法を追加
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

