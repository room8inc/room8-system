-- Googleカレンダー設定を保存するテーブル
CREATE TABLE IF NOT EXISTS google_calendar_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- アクティブな設定は1つだけ
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_settings_active 
  ON google_calendar_settings(is_active) 
  WHERE is_active = true;

COMMENT ON TABLE google_calendar_settings IS 'Googleカレンダー連携の設定（カレンダーIDの選択）';
COMMENT ON COLUMN google_calendar_settings.calendar_id IS '選択されたGoogleカレンダーのID';
COMMENT ON COLUMN google_calendar_settings.calendar_name IS 'カレンダーの表示名';
COMMENT ON COLUMN google_calendar_settings.is_active IS 'この設定がアクティブかどうか（1つだけtrue）';

