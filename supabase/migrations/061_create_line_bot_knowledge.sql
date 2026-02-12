-- LINE Bot ナレッジベース テーブル
-- ブラウザからRoom8の情報を管理し、LINE BotのLLM応答に使用する

CREATE TABLE IF NOT EXISTS line_bot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_line_bot_knowledge_category ON line_bot_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_line_bot_knowledge_active ON line_bot_knowledge(is_active);
CREATE INDEX IF NOT EXISTS idx_line_bot_knowledge_sort ON line_bot_knowledge(category, sort_order);

-- RLS
ALTER TABLE line_bot_knowledge ENABLE ROW LEVEL SECURITY;

-- 管理者のみ全操作可
CREATE POLICY "Allow admins to manage knowledge"
  ON line_bot_knowledge FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- サービスロール（LINE Bot）は読み取り可
CREATE POLICY "Allow service role to read knowledge"
  ON line_bot_knowledge FOR SELECT
  TO service_role
  USING (true);

COMMENT ON TABLE line_bot_knowledge IS 'LINE Botナレッジベース: LLM応答に使用するRoom8の公式情報';
COMMENT ON COLUMN line_bot_knowledge.category IS 'カテゴリ: 基本情報, 料金, 設備・アメニティ, 手続き関連, 見学について, 駐車場, 併設サービス, FAQ';
