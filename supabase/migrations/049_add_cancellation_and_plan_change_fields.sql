-- 退会・プラン変更機能のためのカラム追加

-- user_plansテーブルに解約・変更予定日を追加
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS cancellation_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS plan_change_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS new_plan_id UUID REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS cancellation_fee INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_fee_paid BOOLEAN DEFAULT false;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_user_plans_cancellation_scheduled ON user_plans(cancellation_scheduled_date)
  WHERE cancellation_scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_plans_plan_change_scheduled ON user_plans(plan_change_scheduled_date)
  WHERE plan_change_scheduled_date IS NOT NULL;

-- コメント追加
COMMENT ON COLUMN user_plans.cancellation_scheduled_date IS '解約予定日（15日までに申請すれば翌月1日から適用）';
COMMENT ON COLUMN user_plans.plan_change_scheduled_date IS 'プラン変更予定日（15日までに申請すれば翌月1日から適用、または指定日から適用）';
COMMENT ON COLUMN user_plans.new_plan_id IS '変更先プランID（プラン変更の場合）';
COMMENT ON COLUMN user_plans.cancellation_fee IS '解約料金（長期契約割引の場合）';
COMMENT ON COLUMN user_plans.cancellation_fee_paid IS '解約料金の支払い済みフラグ';

