-- google_calendar_settings に calendar_role カラムを追加
-- 'meeting_room' = 会議室カレンダー, 'personal' = 鶴田カレンダー

-- 1. calendar_role カラム追加（既存レコードはmeeting_roomとして扱う）
ALTER TABLE google_calendar_settings
  ADD COLUMN IF NOT EXISTS calendar_role TEXT NOT NULL DEFAULT 'meeting_room';

-- 2. 既存のUNIQUE制約を削除（is_active=trueで1つだけの制約）
DROP INDEX IF EXISTS idx_google_calendar_settings_active;

-- 3. 新しいUNIQUE制約: calendar_role ごとにアクティブは1つだけ
CREATE UNIQUE INDEX idx_google_calendar_settings_role_active
  ON google_calendar_settings(calendar_role)
  WHERE is_active = true;
