-- Add RLS policies for checkins table
-- Phase 1 MVP: チェックイン/チェックアウト機能のためのポリシー

-- ============================================
-- checkins テーブルのポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow authenticated users to insert their own checkins" ON checkins;
DROP POLICY IF EXISTS "Allow users to read their own checkins" ON checkins;
DROP POLICY IF EXISTS "Allow users to update their own checkins" ON checkins;

-- ポリシー1: 認証済みユーザーは自分のチェックインをINSERTできる
CREATE POLICY "Allow authenticated users to insert their own checkins"
  ON checkins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ポリシー2: 認証済みユーザーは自分のチェックイン情報をSELECTできる
CREATE POLICY "Allow users to read their own checkins"
  ON checkins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ポリシー3: 認証済みユーザーは自分のチェックイン情報をUPDATEできる（チェックアウト時）
CREATE POLICY "Allow users to update their own checkins"
  ON checkins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 注意: 管理者が全チェックイン情報を閲覧・管理する場合は、別途管理者用のポリシーを追加する必要があります
-- Phase 1-4（管理画面実装時）に追加予定

