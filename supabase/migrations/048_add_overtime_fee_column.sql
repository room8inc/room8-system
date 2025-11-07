-- 時間外利用料金カラムを追加
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS overtime_fee INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_fee_billed BOOLEAN DEFAULT false;

-- インデックスを追加（月末決済のクエリ用）
CREATE INDEX IF NOT EXISTS idx_checkins_overtime_billing 
  ON checkins(user_id, checkout_at, is_overtime, overtime_fee_billed)
  WHERE is_overtime = true AND checkout_at IS NOT NULL;

-- コメントを追加
COMMENT ON COLUMN checkins.overtime_fee IS '時間外利用料金（円、会員の月末決済用）';
COMMENT ON COLUMN checkins.overtime_fee_billed IS '時間外利用料金の請求済みフラグ（月末決済で使用）';

