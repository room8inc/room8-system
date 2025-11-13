-- Add DELETE policy for checkins table
-- ユーザーが自分のチェックインを削除できるようにする（5分以内のキャンセル用）

-- ============================================
-- checkins テーブルのDELETEポリシー
-- ============================================

-- ポリシー: 認証済みユーザーは自分のチェックインをDELETEできる
DROP POLICY IF EXISTS "Allow users to delete their own checkins" ON checkins;
CREATE POLICY "Allow users to delete their own checkins"
  ON checkins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

