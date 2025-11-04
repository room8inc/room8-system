-- usersテーブルにis_staffカラムを追加
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT false;

-- staff_membersテーブルにauth_user_idカラムを追加（スタッフのauth.usersとの紐付け）
ALTER TABLE staff_members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- checkinsテーブルにstaff_member_idカラムを追加（どのスタッフがチェックインしたかを記録）
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_staff_members_auth_user_id ON staff_members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_staff_member_id ON checkins(staff_member_id);

-- コメントを追加
COMMENT ON COLUMN users.is_staff IS 'スタッフアカウントかどうか（true: スタッフ、false: 通常ユーザー）';
COMMENT ON COLUMN staff_members.auth_user_id IS 'このスタッフのauth.usersのID（スタッフ用アカウント）';
COMMENT ON COLUMN checkins.staff_member_id IS 'チェックインしたスタッフのID（法人のスタッフが利用した場合）';

