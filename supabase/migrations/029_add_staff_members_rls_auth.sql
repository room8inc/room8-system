-- スタッフは自分のstaff_membersレコードを読み取れるようにする
CREATE POLICY "Allow staff to read their own staff_member record"
  ON staff_members FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR
    company_user_id = auth.uid()
  );

-- 既存のポリシーを確認して必要に応じて更新
-- スタッフは自分のstaff_membersレコードを更新できるようにする（必要に応じて）
-- ただし、通常は法人ユーザーが管理するため、スタッフ自身の更新は制限する

