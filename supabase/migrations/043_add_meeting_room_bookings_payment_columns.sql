-- Add payment-related columns to meeting_room_bookings table
-- 会議室予約テーブルに決済関連カラムを追加

-- Stripe決済関連のカラムを追加
ALTER TABLE meeting_room_bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS billing_month DATE; -- 会員の月末まとめ請求用（どの月の請求か）

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_stripe_payment_intent_id ON meeting_room_bookings(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_payment_status ON meeting_room_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_billing_month ON meeting_room_bookings(billing_month);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_billing_user_pending ON meeting_room_bookings(billing_user_id, payment_status, billing_month) WHERE payment_status = 'pending';

-- コメントを追加
COMMENT ON COLUMN meeting_room_bookings.stripe_payment_intent_id IS 'Stripe Payment Intent ID（非会員の即時決済用）';
COMMENT ON COLUMN meeting_room_bookings.payment_status IS '決済状態（pending: 未決済、paid: 決済済み、failed: 決済失敗、refunded: 返金済み、cancelled: キャンセル）';
COMMENT ON COLUMN meeting_room_bookings.payment_date IS '決済日時';
COMMENT ON COLUMN meeting_room_bookings.billing_month IS '会員の月末まとめ請求用（どの月の請求か。例：2025-01-01は2025年1月分）';

