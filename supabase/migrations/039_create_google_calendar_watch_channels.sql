-- GoogleカレンダーWatchチャンネル管理テーブル
CREATE TABLE IF NOT EXISTS google_calendar_watch_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_google_calendar_watch_channels_calendar_id 
  ON google_calendar_watch_channels(calendar_id);

CREATE INDEX IF NOT EXISTS idx_google_calendar_watch_channels_expiration 
  ON google_calendar_watch_channels(expiration);

-- コメント
COMMENT ON TABLE google_calendar_watch_channels IS 'GoogleカレンダーWatchチャンネル管理テーブル';
COMMENT ON COLUMN google_calendar_watch_channels.channel_id IS 'Google Calendar APIのチャンネルID';
COMMENT ON COLUMN google_calendar_watch_channels.resource_id IS 'Google Calendar APIのリソースID';
COMMENT ON COLUMN google_calendar_watch_channels.expiration IS 'チャンネルの有効期限';

