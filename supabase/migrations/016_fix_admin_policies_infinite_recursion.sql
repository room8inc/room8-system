-- Fix infinite recursion in admin RLS policies
-- Phase 1 MVP: 管理者ポリシーの無限再帰問題を修正

-- ============================================
-- 問題: 013_add_admin_policies.sqlの管理者ポリシーで、
-- usersテーブルを読み取る際に同じusersテーブルを参照しているため、
-- 無限再帰が発生している
-- ============================================

-- ============================================
-- 解決策: SECURITY DEFINER関数を使用してRLSをバイパス
-- ============================================

-- 関数1: 現在のユーザーが管理者かどうかをチェック（RLSをバイパス）
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_check BOOLEAN;
BEGIN
  -- SECURITY DEFINERにより、RLSをバイパスしてusersテーブルにアクセス
  SELECT is_admin INTO admin_check
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(admin_check, false);
END;
$$;

-- ============================================
-- users テーブルの管理者用ポリシーを修正
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Allow admins to read all users" ON users;
DROP POLICY IF EXISTS "Allow admins to update all users" ON users;

-- ポリシー1: 管理者は全ユーザー情報をSELECTできる
-- 注意: is_admin_user()関数を使用することで、無限再帰を回避
CREATE POLICY "Allow admins to read all users"
  ON users FOR SELECT
  TO authenticated
  USING (public.is_admin_user() = true);

-- ポリシー2: 管理者は全ユーザー情報をUPDATEできる
CREATE POLICY "Allow admins to update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- ============================================
-- user_plans テーブルの管理者用ポリシーを修正
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Allow admins to read all user plans" ON user_plans;
DROP POLICY IF EXISTS "Allow admins to insert user plans" ON user_plans;
DROP POLICY IF EXISTS "Allow admins to update all user plans" ON user_plans;

-- ポリシー1: 管理者は全ユーザーのプラン契約情報をSELECTできる
CREATE POLICY "Allow admins to read all user plans"
  ON user_plans FOR SELECT
  TO authenticated
  USING (public.is_admin_user() = true);

-- ポリシー2: 管理者は全ユーザーのプラン契約をINSERTできる
CREATE POLICY "Allow admins to insert user plans"
  ON user_plans FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user() = true);

-- ポリシー3: 管理者は全ユーザーのプラン契約情報をUPDATEできる
CREATE POLICY "Allow admins to update all user plans"
  ON user_plans FOR UPDATE
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- ============================================
-- 注意事項
-- ============================================
-- 1. is_admin_user()関数はSECURITY DEFINERを使用しているため、
--    RLSをバイパスしてusersテーブルにアクセスできます
-- 2. これにより、管理者ポリシーでusersテーブルを参照しても、
--    無限再帰が発生しません
-- 3. ユーザー自身が自分の情報を読み取るには、
--    005_add_users_policies.sqlの「Allow users to read their own data」ポリシーが適用されます

