-- google_calendar_watch_channelsテーブルのRLSを有効化
ALTER TABLE google_calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- 管理者のみが管理できるポリシー
DROP POLICY IF EXISTS "Allow admins to manage google_calendar_watch_channels" ON google_calendar_watch_channels;

CREATE POLICY "Allow admins to manage google_calendar_watch_channels"
  ON google_calendar_watch_channels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

