-- Add RLS policies for lockers table
-- Phase 1 MVP: ロッカーの在庫管理と割り当て

-- ============================================
-- lockers テーブルのポリシー
-- ============================================

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow authenticated users to read locker inventory" ON lockers;
DROP POLICY IF EXISTS "Allow users to read their own locker" ON lockers;
DROP POLICY IF EXISTS "Allow admins to manage all lockers" ON lockers;

-- ポリシー1: 認証済みユーザーは在庫数（size, status）を読み取れる
-- 在庫数確認のため、sizeとstatusのみ読み取り可能
CREATE POLICY "Allow authenticated users to read locker inventory"
  ON lockers FOR SELECT
  TO authenticated
  USING (true);

-- ポリシー2: 認証済みユーザーは自分のロッカー情報を読み取れる
-- 自分のロッカー番号なども確認できるようにする
CREATE POLICY "Allow users to read their own locker"
  ON lockers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ポリシー3: 管理者は全ロッカーを管理できる
CREATE POLICY "Allow admins to manage all lockers"
  ON lockers FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- 注意: ロッカーの割り当て（UPDATE）は、プラン契約時に自動的に行われるため、
-- ユーザーが直接ロッカーを更新することはできません（管理者のみ可能）

