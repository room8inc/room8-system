-- google_calendar_events_cacheテーブルのRLSを有効化
ALTER TABLE google_calendar_events_cache ENABLE ROW LEVEL SECURITY;

-- 管理者のみが管理できるポリシー
DROP POLICY IF EXISTS "Allow admins to manage google_calendar_events_cache" ON google_calendar_events_cache;

CREATE POLICY "Allow admins to manage google_calendar_events_cache"
  ON google_calendar_events_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- 全ユーザーが読み取り可能（空き状況確認用）
DROP POLICY IF EXISTS "Allow public to read google_calendar_events_cache" ON google_calendar_events_cache;

CREATE POLICY "Allow public to read google_calendar_events_cache"
  ON google_calendar_events_cache
  FOR SELECT
  USING (true);

