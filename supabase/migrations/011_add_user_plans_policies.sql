-- Add RLS policies for user_plans table
-- Phase 1 MVP: プラン契約機能のためのポリシー

-- ============================================
-- user_plans テーブルのポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow authenticated users to insert their own plans" ON user_plans;
DROP POLICY IF EXISTS "Allow users to read their own plans" ON user_plans;
DROP POLICY IF EXISTS "Allow users to update their own plans" ON user_plans;

-- ポリシー1: 認証済みユーザーは自分のプラン契約をINSERTできる
CREATE POLICY "Allow authenticated users to insert their own plans"
  ON user_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ポリシー2: 認証済みユーザーは自分のプラン契約情報をSELECTできる
CREATE POLICY "Allow users to read their own plans"
  ON user_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ポリシー3: 認証済みユーザーは自分のプラン契約情報をUPDATEできる（プラン変更時など）
CREATE POLICY "Allow users to update their own plans"
  ON user_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 注意: 管理者が全プラン契約情報を閲覧・管理する場合は、別途管理者用のポリシーを追加する必要があります
-- Phase 1-4（管理画面実装時）に追加予定

