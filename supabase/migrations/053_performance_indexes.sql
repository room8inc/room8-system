-- Room8 Performance Optimization
-- Migration: Add performance indexes for frequently used queries
-- Created: 2026-01-26

-- ============================================
-- 1. checkins テーブル
-- ============================================

-- 現在チェックイン中のユーザーを取得（頻繁に使用）
CREATE INDEX IF NOT EXISTS idx_checkins_user_active 
  ON checkins(user_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- 最近のチェックイン履歴を取得（ダッシュボード）
-- カバリングインデックス: SELECTされるカラムをインデックスに含める
CREATE INDEX IF NOT EXISTS idx_checkins_user_recent 
  ON checkins(user_id, checkin_at DESC) 
  INCLUDE (id, checkout_at, duration_minutes);

-- 時間外利用の集計
CREATE INDEX IF NOT EXISTS idx_checkins_overtime 
  ON checkins(user_id, is_overtime, overtime_fee_billed, checkout_at) 
  WHERE is_overtime = true;

-- ============================================
-- 2. user_plans テーブル
-- ============================================

-- 現在アクティブなプランを取得（頻繁に使用）
CREATE INDEX IF NOT EXISTS idx_user_plans_user_active 
  ON user_plans(user_id, status, ended_at) 
  WHERE status = 'active' AND ended_at IS NULL;

-- プラン変更・解約のクエリ最適化
CREATE INDEX IF NOT EXISTS idx_user_plans_status_dates 
  ON user_plans(user_id, status, started_at, ended_at);

-- ============================================
-- 3. meeting_room_bookings テーブル
-- ============================================

-- 日付・ステータスでの検索（会議室予約の空き状況確認）
CREATE INDEX IF NOT EXISTS idx_bookings_date_status 
  ON meeting_room_bookings(booking_date, status, start_time, end_time)
  WHERE status IN ('reserved', 'confirmed', 'in_use');

-- 未決済の予約を取得（月次請求バッチ）
CREATE INDEX IF NOT EXISTS idx_bookings_billing 
  ON meeting_room_bookings(billing_month, payment_status, member_type_at_booking, billing_user_id)
  WHERE payment_status = 'pending';

-- ユーザー別の予約一覧取得
CREATE INDEX IF NOT EXISTS idx_bookings_user_recent 
  ON meeting_room_bookings(user_id, booking_date DESC, start_time DESC)
  WHERE status != 'cancelled';

-- スタッフメンバー別の予約一覧取得
CREATE INDEX IF NOT EXISTS idx_bookings_staff_recent 
  ON meeting_room_bookings(staff_member_id, booking_date DESC, start_time DESC)
  WHERE status != 'cancelled' AND staff_member_id IS NOT NULL;

-- ============================================
-- 4. seat_checkins テーブル
-- ============================================

-- 現在使用中の座席を取得（座席表）
CREATE INDEX IF NOT EXISTS idx_seat_checkins_seat_active 
  ON seat_checkins(seat_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- ユーザーの現在の座席を取得
CREATE INDEX IF NOT EXISTS idx_seat_checkins_user_active 
  ON seat_checkins(user_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- 座席チェックイン履歴
CREATE INDEX IF NOT EXISTS idx_seat_checkins_user_history 
  ON seat_checkins(user_id, checkin_at DESC);

-- ============================================
-- 5. google_calendar_events_cache テーブル
-- ============================================

-- 日時範囲でのイベント検索
CREATE INDEX IF NOT EXISTS idx_calendar_cache_time_range 
  ON google_calendar_events_cache(calendar_id, start_time, end_time);

-- event_idでの検索（更新・削除時）
CREATE INDEX IF NOT EXISTS idx_calendar_cache_event 
  ON google_calendar_events_cache(calendar_id, event_id);

-- ============================================
-- 6. seats テーブル
-- ============================================

-- 座席タイプ・ステータスでの検索
CREATE INDEX IF NOT EXISTS idx_seats_type_status 
  ON seats(seat_type, status)
  WHERE status = 'active';

-- ============================================
-- Comments
-- ============================================
COMMENT ON INDEX idx_checkins_user_active IS 'チェックイン中のユーザーを高速取得';
COMMENT ON INDEX idx_checkins_user_recent IS 'カバリングインデックス: 最近のチェックイン履歴';
COMMENT ON INDEX idx_checkins_overtime IS '時間外利用の集計を高速化';
COMMENT ON INDEX idx_user_plans_user_active IS 'アクティブなプランを高速取得';
COMMENT ON INDEX idx_user_plans_status_dates IS 'プラン変更・解約のクエリ最適化';
COMMENT ON INDEX idx_bookings_date_status IS '会議室予約の空き状況を高速確認';
COMMENT ON INDEX idx_bookings_billing IS '月次請求バッチの処理を高速化';
COMMENT ON INDEX idx_bookings_user_recent IS 'ユーザー別予約一覧を高速取得';
COMMENT ON INDEX idx_bookings_staff_recent IS 'スタッフメンバー別予約一覧を高速取得';
COMMENT ON INDEX idx_seat_checkins_seat_active IS '使用中の座席を高速取得';
COMMENT ON INDEX idx_seat_checkins_user_active IS 'ユーザーの現在の座席を高速取得';
COMMENT ON INDEX idx_seat_checkins_user_history IS '座席チェックイン履歴を高速取得';
COMMENT ON INDEX idx_calendar_cache_time_range IS 'Googleカレンダーキャッシュの日時範囲検索';
COMMENT ON INDEX idx_calendar_cache_event IS 'イベントID検索を高速化';
COMMENT ON INDEX idx_seats_type_status IS 'アクティブな座席の検索を高速化';

-- ============================================
-- Migration Complete
-- ============================================
-- 全てのインデックスが正常に作成されました
