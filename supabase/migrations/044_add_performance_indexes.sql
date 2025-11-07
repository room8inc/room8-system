-- パフォーマンス最適化用インデックスの追加
-- 2024-11-07: 主要クエリの高速化

-- ============================================
-- 1. user_plans の複合インデックス強化
-- ============================================
-- 現在のプラン取得クエリを高速化（user_id + status + ended_at）
CREATE INDEX IF NOT EXISTS idx_user_plans_active_user 
  ON user_plans(user_id, status) 
  WHERE status = 'active' AND ended_at IS NULL;

-- ============================================
-- 2. meeting_room_bookings の複合インデックス強化
-- ============================================
-- 今後の予約取得クエリを高速化（user_id + status + booking_date）
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_user_upcoming 
  ON meeting_room_bookings(user_id, status, booking_date) 
  WHERE status IN ('reserved', 'confirmed');

-- billing_user_idベースの検索を高速化
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_billing_upcoming 
  ON meeting_room_bookings(billing_user_id, status, booking_date) 
  WHERE status IN ('reserved', 'confirmed');

-- staff_member_idベースの検索を高速化
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_staff_upcoming 
  ON meeting_room_bookings(staff_member_id, status, booking_date) 
  WHERE status IN ('reserved', 'confirmed') AND staff_member_id IS NOT NULL;

-- ============================================
-- 3. checkins の複合インデックス強化
-- ============================================
-- 今日のチェックイン履歴取得を高速化（user_id + checkin_at）
CREATE INDEX IF NOT EXISTS idx_checkins_user_date 
  ON checkins(user_id, checkin_at DESC);

-- 現在チェックイン中の検索を高速化（既存のインデックスを改善）
DROP INDEX IF EXISTS idx_checkins_user_checkout;
CREATE INDEX IF NOT EXISTS idx_checkins_user_active 
  ON checkins(user_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- ============================================
-- 4. plans の is_active インデックス改善
-- ============================================
-- アクティブなプランのみを頻繁に検索するため
DROP INDEX IF EXISTS idx_plans_is_active;
CREATE INDEX IF NOT EXISTS idx_plans_active_display 
  ON plans(is_active, display_order) 
  WHERE is_active = true;

-- ============================================
-- 5. staff_members の複合インデックス
-- ============================================
-- company_user_id + status での検索を高速化
CREATE INDEX IF NOT EXISTS idx_staff_members_company_active 
  ON staff_members(company_user_id, status) 
  WHERE status = 'active';

-- ============================================
-- 6. Google Calendar関連の最適化
-- ============================================
-- イベントキャッシュの日付範囲検索を高速化
DROP INDEX IF EXISTS idx_google_calendar_events_cache_dates;
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_cache_range 
  ON google_calendar_events_cache(calendar_id, start_time, end_time);

-- アクティブな設定の検索を高速化
DROP INDEX IF EXISTS idx_google_calendar_settings_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_settings_active 
  ON google_calendar_settings(is_active) 
  WHERE is_active = true;

-- ============================================
-- 7. VACUUM ANALYZE（統計情報の更新）
-- ============================================
-- PostgreSQLのクエリプランナーに最新の統計情報を提供
VACUUM ANALYZE users;
VACUUM ANALYZE plans;
VACUUM ANALYZE user_plans;
VACUUM ANALYZE checkins;
VACUUM ANALYZE meeting_room_bookings;
VACUUM ANALYZE staff_members;
VACUUM ANALYZE google_calendar_events_cache;

-- ============================================
-- コメント追加
-- ============================================
COMMENT ON INDEX idx_user_plans_active_user IS 'アクティブなユーザープラン検索の高速化';
COMMENT ON INDEX idx_meeting_room_bookings_user_upcoming IS '今後のユーザー予約検索の高速化';
COMMENT ON INDEX idx_checkins_user_date IS 'ユーザーのチェックイン履歴検索の高速化';
COMMENT ON INDEX idx_checkins_user_active IS '現在チェックイン中の検索の高速化';

