-- ============================================
-- 059: group_plans オーナーにUPDATE権限を追加
--
-- 問題: group_plans のUPDATEが管理者のみに制限されていたため
--       オーナーがグループ解約できなかった
-- ============================================

BEGIN;

DROP POLICY IF EXISTS "group_plans_admin_modify" ON group_plans;

-- UPDATE: オーナー or 管理者
CREATE POLICY "group_plans_update"
  ON group_plans FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.is_admin_user() = true
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR public.is_admin_user() = true
  );

COMMIT;
