-- Add payment-related columns to checkins table
-- チェックイン/チェックアウトテーブルに決済関連カラムを追加（ドロップイン決済用）

-- Stripe決済関連のカラムを追加
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refund_amount INTEGER DEFAULT 0; -- 返金額（円）

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_checkins_stripe_payment_intent_id ON checkins(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_checkins_payment_status ON checkins(payment_status);
CREATE INDEX IF NOT EXISTS idx_checkins_dropin_pending ON checkins(user_id, payment_status, member_type_at_checkin) 
  WHERE member_type_at_checkin = 'dropin' AND payment_status = 'pending';

-- コメントを追加
COMMENT ON COLUMN checkins.stripe_payment_intent_id IS 'Stripe Payment Intent ID（ドロップイン会員の事前決済用）';
COMMENT ON COLUMN checkins.payment_status IS '決済状態（pending: 未決済、paid: 決済済み、refunded: 返金済み、failed: 決済失敗）';
COMMENT ON COLUMN checkins.payment_date IS '決済日時';
COMMENT ON COLUMN checkins.refund_amount IS '返金額（円、チェックアウト時の差額返金用）';
COMMENT ON COLUMN checkins.dropin_fee IS 'ドロップイン料金（円、実際に請求された金額）';

