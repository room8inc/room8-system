-- ============================================
-- 058: グループ関連RLS完全修正
--
-- 問題: ポリシー内のサブクエリがテーブル間で循環参照
--   group_members → group_plans → group_members → ∞
-- 解決: 全ポリシーからサブクエリを排除。
--   すべて SECURITY DEFINER 関数経由にする（RLSバイパス）
-- ============================================

BEGIN;

-- ============================================
-- 1. SECURITY DEFINER ヘルパー関数（RLSバイパス）
-- ============================================

-- グループのオーナーか？
CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_plans
    WHERE id = p_group_plan_id
    AND owner_user_id = auth.uid()
  );
$$;

-- グループのメンバーか？（既に057で作成済みだが念のため再作成）
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_plan_id = p_group_plan_id
    AND user_id = auth.uid()
    AND status = 'active'
  );
$$;

-- グループのowner/adminか？（既に057で作成済みだが念のため再作成）
CREATE OR REPLACE FUNCTION public.is_group_owner_or_admin(p_group_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_plan_id = p_group_plan_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
$$;

-- ============================================
-- 2. group_plans ポリシー全削除 → 再作成
-- ============================================

DROP POLICY IF EXISTS "group_plans_select_member" ON group_plans;
DROP POLICY IF EXISTS "group_plans_admin_all" ON group_plans;
DROP POLICY IF EXISTS "group_plans_insert_owner" ON group_plans;

-- SELECT: オーナー or メンバー or 管理者
CREATE POLICY "group_plans_select"
  ON group_plans FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.is_group_member(id)
    OR public.is_admin_user() = true
  );

-- INSERT: 自分がオーナーとして作成
CREATE POLICY "group_plans_insert"
  ON group_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    OR public.is_admin_user() = true
  );

-- UPDATE/DELETE: 管理者のみ
CREATE POLICY "group_plans_admin_modify"
  ON group_plans FOR UPDATE
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

CREATE POLICY "group_plans_admin_delete"
  ON group_plans FOR DELETE
  TO authenticated
  USING (public.is_admin_user() = true);

-- ============================================
-- 3. group_slots ポリシー全削除 → 再作成
-- ============================================

DROP POLICY IF EXISTS "group_slots_select_member" ON group_slots;
DROP POLICY IF EXISTS "group_slots_admin_all" ON group_slots;
DROP POLICY IF EXISTS "group_slots_insert_owner" ON group_slots;

-- SELECT: メンバー or オーナー or 管理者
CREATE POLICY "group_slots_select"
  ON group_slots FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(group_plan_id)
    OR public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  );

-- INSERT: オーナー or 管理者
CREATE POLICY "group_slots_insert"
  ON group_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  );

-- UPDATE/DELETE: 管理者のみ
CREATE POLICY "group_slots_admin_update"
  ON group_slots FOR UPDATE
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

CREATE POLICY "group_slots_admin_delete"
  ON group_slots FOR DELETE
  TO authenticated
  USING (public.is_admin_user() = true);

-- ============================================
-- 4. group_members ポリシー全削除 → 再作成
-- ============================================

DROP POLICY IF EXISTS "group_members_select" ON group_members;
DROP POLICY IF EXISTS "group_members_owner_admin_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_owner_admin_update" ON group_members;
DROP POLICY IF EXISTS "group_members_owner_admin_delete" ON group_members;

-- SELECT: 自分 or オーナー（全メンバー見える） or 管理者
CREATE POLICY "group_members_select"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  );

-- INSERT: オーナー or 管理者
CREATE POLICY "group_members_insert"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  );

-- UPDATE: オーナー or 管理者
CREATE POLICY "group_members_update"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  )
  WITH CHECK (
    public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  );

-- DELETE: オーナー or 管理者
CREATE POLICY "group_members_delete"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    public.is_group_owner(group_plan_id)
    OR public.is_admin_user() = true
  );

COMMIT;
