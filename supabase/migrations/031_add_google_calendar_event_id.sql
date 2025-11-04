-- Googleカレンダー連携用のカラムを追加
ALTER TABLE meeting_room_bookings
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_google_calendar_event_id 
  ON meeting_room_bookings(google_calendar_event_id);

COMMENT ON COLUMN meeting_room_bookings.google_calendar_event_id IS 'GoogleカレンダーのイベントID（予約キャンセル時にGoogleカレンダーから削除するために使用）';

