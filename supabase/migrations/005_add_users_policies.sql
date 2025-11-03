-- Add RLS policies for users table
-- Phase 1 MVP: 認証機能実装のためのポリシー

-- ============================================
-- users テーブルのポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow authenticated users to insert their own data" ON users;
DROP POLICY IF EXISTS "Allow users to read their own data" ON users;
DROP POLICY IF EXISTS "Allow users to update their own data" ON users;

-- ポリシー1: 認証済みユーザーは自分の情報をINSERTできる（会員登録時）
-- 会員登録時に、認証済みユーザーが自分の情報をusersテーブルにINSERTできるようにする
-- 注意: signUp後は自動的にセッションが確立されるので、auth.uid()が使える
CREATE POLICY "Allow authenticated users to insert their own data"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ポリシー2: 認証済みユーザーは自分の情報をSELECTできる
CREATE POLICY "Allow users to read their own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ポリシー3: 認証済みユーザーは自分の情報をUPDATEできる
CREATE POLICY "Allow users to update their own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 注意: 管理者が全ユーザー情報を閲覧・管理する場合は、別途管理者用のポリシーを追加する必要があります
-- Phase 1-4（管理画面実装時）に追加予定

