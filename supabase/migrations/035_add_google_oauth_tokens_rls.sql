-- Google OAuthトークンのRLSポリシー
-- 管理者のみアクセス可能
CREATE POLICY "Allow admins to manage google_oauth_tokens"
  ON google_oauth_tokens FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- サーバー側でのみ読み取り可能（カレンダーAPI呼び出し時）
-- 注意: 実際の使用時はService Role Keyを使用するため、RLSはバイパスされます

