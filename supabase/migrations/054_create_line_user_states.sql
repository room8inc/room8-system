-- LINE Bot ユーザー状態管理テーブル
CREATE TABLE IF NOT EXISTS line_user_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  state TEXT NOT NULL DEFAULT 'idle',
  usage_type TEXT,
  time_slot TEXT,
  needs_address TEXT,
  recommended_plan TEXT,
  booking_datetime TIMESTAMPTZ,
  booking_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_line_user_states_line_user_id ON line_user_states (line_user_id);

-- RLS有効化（service_roleでバイパスするため、ポリシーは不要）
ALTER TABLE line_user_states ENABLE ROW LEVEL SECURITY;
