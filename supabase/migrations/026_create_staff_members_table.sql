-- Add staff members table for company users
-- 法人ユーザーのスタッフ管理機能

-- ============================================
-- staff_members (スタッフテーブル)
-- ============================================
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_kana TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for staff_members
CREATE INDEX IF NOT EXISTS idx_staff_members_company_user_id ON staff_members(company_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_status ON staff_members(status);

-- Comments
COMMENT ON TABLE staff_members IS '法人ユーザーのスタッフ一覧';
COMMENT ON COLUMN staff_members.company_user_id IS '法人ユーザーID（親ユーザー）';
COMMENT ON COLUMN staff_members.name IS 'スタッフ名（姓 名）';
COMMENT ON COLUMN staff_members.status IS 'ステータス（active: アクティブ, inactive: 非アクティブ, removed: 削除済み）';

-- Trigger: Update updated_at timestamp
CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON staff_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

