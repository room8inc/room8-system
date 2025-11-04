-- Add RLS policies for admin users
-- Phase 1 MVP: 管理者が全ユーザーの情報を閲覧・編集できるようにする

-- ============================================
-- users テーブルの管理者用ポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow admins to read all users" ON users;
DROP POLICY IF EXISTS "Allow admins to update all users" ON users;

-- ポリシー1: 管理者は全ユーザー情報をSELECTできる
CREATE POLICY "Allow admins to read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ポリシー2: 管理者は全ユーザー情報をUPDATEできる
CREATE POLICY "Allow admins to update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ============================================
-- user_plans テーブルの管理者用ポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow admins to read all user plans" ON user_plans;
DROP POLICY IF EXISTS "Allow admins to insert user plans" ON user_plans;
DROP POLICY IF EXISTS "Allow admins to update all user plans" ON user_plans;

-- ポリシー1: 管理者は全ユーザーのプラン契約情報をSELECTできる
CREATE POLICY "Allow admins to read all user plans"
  ON user_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ポリシー2: 管理者は全ユーザーのプラン契約をINSERTできる
CREATE POLICY "Allow admins to insert user plans"
  ON user_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ポリシー3: 管理者は全ユーザーのプラン契約情報をUPDATEできる
CREATE POLICY "Allow admins to update all user plans"
  ON user_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

