-- Add RLS policies for staff_members table
-- スタッフテーブルのRLSポリシー

-- ============================================
-- RLSポリシー: staff_members
-- ============================================

-- RLSを有効化
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- 法人ユーザーは自分のスタッフを閲覧・管理できる
CREATE POLICY "Allow company users to manage their own staff"
  ON staff_members FOR ALL
  TO authenticated
  USING (
    company_user_id IN (
      SELECT id FROM users WHERE id = auth.uid() AND is_individual = false
    )
  )
  WITH CHECK (
    company_user_id IN (
      SELECT id FROM users WHERE id = auth.uid() AND is_individual = false
    )
  );

-- 管理者はすべてのスタッフを閲覧・管理できる
CREATE POLICY "Allow admins to manage all staff"
  ON staff_members FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

