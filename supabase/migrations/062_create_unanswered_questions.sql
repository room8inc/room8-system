-- LINE Bot 未回答質問ログテーブル
-- LLMが答えられなかった質問を記録し、ナレッジ改善に活用する

CREATE TABLE IF NOT EXISTS line_bot_unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  user_name TEXT,
  user_message TEXT NOT NULL,
  bot_reply TEXT,
  intent TEXT,
  staff_message TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_knowledge_id UUID REFERENCES line_bot_knowledge(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unanswered_questions_resolved ON line_bot_unanswered_questions(is_resolved);
CREATE INDEX IF NOT EXISTS idx_unanswered_questions_created ON line_bot_unanswered_questions(created_at DESC);

-- RLS
ALTER TABLE line_bot_unanswered_questions ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧・更新可
CREATE POLICY "Allow admins to manage unanswered questions"
  ON line_bot_unanswered_questions FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- サービスロール（LINE Bot）は挿入可
CREATE POLICY "Allow service role to insert unanswered questions"
  ON line_bot_unanswered_questions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- サービスロールは読み取りも可（将来の集計等のため）
CREATE POLICY "Allow service role to read unanswered questions"
  ON line_bot_unanswered_questions FOR SELECT
  TO service_role
  USING (true);

COMMENT ON TABLE line_bot_unanswered_questions IS 'LINE Botが答えられなかった質問のログ';
