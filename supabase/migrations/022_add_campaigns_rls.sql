-- Add RLS policies for campaigns table
-- Phase 1 MVP: キャンペーンのRLSポリシー

-- ============================================
-- campaigns テーブルのポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow public to read active campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow admins to manage all campaigns" ON campaigns;

-- ポリシー1: 認証済みユーザーは有効なキャンペーンを読み取れる
CREATE POLICY "Allow public to read active campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (is_active = true AND (ended_at IS NULL OR ended_at >= CURRENT_DATE));

-- ポリシー2: 管理者は全キャンペーンを管理できる
CREATE POLICY "Allow admins to manage all campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

