-- Google OAuth認証トークンを保存するテーブル
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- アクティブなトークンは1つだけ
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_oauth_tokens_active 
  ON google_oauth_tokens(expires_at) 
  WHERE expires_at IS NULL OR expires_at > NOW();

COMMENT ON TABLE google_oauth_tokens IS 'Google OAuth認証トークン（管理者のGoogleアカウント連携用）';
COMMENT ON COLUMN google_oauth_tokens.access_token IS 'アクセストークン（暗号化推奨）';
COMMENT ON COLUMN google_oauth_tokens.refresh_token IS 'リフレッシュトークン（暗号化推奨）';
COMMENT ON COLUMN google_oauth_tokens.expires_at IS 'トークンの有効期限';

