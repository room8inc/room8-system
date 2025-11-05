-- Googleカレンダーのイベントをキャッシュするテーブル
CREATE TABLE IF NOT EXISTS google_calendar_events_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL, -- GoogleカレンダーのイベントID
  calendar_id TEXT NOT NULL,
  summary TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, calendar_id)
);

-- インデックスで検索速度を向上
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_cache_dates 
  ON google_calendar_events_cache(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_google_calendar_events_cache_calendar_id 
  ON google_calendar_events_cache(calendar_id);

CREATE INDEX IF NOT EXISTS idx_google_calendar_events_cache_event_id 
  ON google_calendar_events_cache(event_id);

-- コメント
COMMENT ON TABLE google_calendar_events_cache IS 'Googleカレンダーのイベントをキャッシュするテーブル';
COMMENT ON COLUMN google_calendar_events_cache.event_id IS 'GoogleカレンダーのイベントID';
COMMENT ON COLUMN google_calendar_events_cache.calendar_id IS 'GoogleカレンダーID';
COMMENT ON COLUMN google_calendar_events_cache.start_time IS 'イベント開始時刻（UTC）';
COMMENT ON COLUMN google_calendar_events_cache.end_time IS 'イベント終了時刻（UTC）';

