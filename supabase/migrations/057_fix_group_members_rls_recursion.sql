-- ============================================
-- 057: group_members RLS 無限再帰を修正
--
-- 問題: group_members のポリシーが group_members 自身を
--       サブクエリで参照 → SELECTポリシーが再帰的に発火 → 無限ループ
-- 解決: SECURITY DEFINER関数でRLSをバイパスして参照する
-- ============================================

BEGIN;

-- ============================================
-- 1. SECURITY DEFINER ヘルパー関数
--    （RLSをバイパスして group_members を参照できる）
-- ============================================

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
-- 2. 古いポリシーを削除
-- ============================================

DROP POLICY IF EXISTS "group_members_select" ON group_members;
DROP POLICY IF EXISTS "group_members_owner_admin_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_owner_admin_update" ON group_members;
DROP POLICY IF EXISTS "group_members_owner_admin_delete" ON group_members;

-- ============================================
-- 3. 修正版ポリシー（自己参照なし）
-- ============================================

-- SELECT: 自分 or 同グループメンバー or 管理者
CREATE POLICY "group_members_select"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_plan_id)
    OR public.is_admin_user() = true
  );

-- INSERT: グループオーナー or 既存owner/admin or 管理者
CREATE POLICY "group_members_owner_admin_insert"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    group_plan_id IN (
      SELECT id FROM group_plans
      WHERE owner_user_id = auth.uid()
    )
    OR public.is_group_owner_or_admin(group_plan_id)
    OR public.is_admin_user() = true
  );

-- UPDATE: owner/admin or 管理者
CREATE POLICY "group_members_owner_admin_update"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    public.is_group_owner_or_admin(group_plan_id)
    OR public.is_admin_user() = true
  )
  WITH CHECK (
    public.is_group_owner_or_admin(group_plan_id)
    OR public.is_admin_user() = true
  );

-- DELETE: owner/admin or 管理者
CREATE POLICY "group_members_owner_admin_delete"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    public.is_group_owner_or_admin(group_plan_id)
    OR public.is_admin_user() = true
  );

COMMIT;
