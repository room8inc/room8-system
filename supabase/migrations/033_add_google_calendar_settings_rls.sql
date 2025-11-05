-- RLSを有効化
ALTER TABLE google_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Googleカレンダー設定のRLSポリシー
-- 管理者のみアクセス可能
CREATE POLICY "Allow admins to manage google_calendar_settings"
  ON google_calendar_settings FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- 全ユーザーが読み取り可能（予約時に使用）
CREATE POLICY "Allow authenticated users to read active google_calendar_settings"
  ON google_calendar_settings FOR SELECT
  TO authenticated
  USING (is_active = true);

