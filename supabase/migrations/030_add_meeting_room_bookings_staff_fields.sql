-- meeting_room_bookingsテーブルにスタッフ関連カラムを追加
ALTER TABLE meeting_room_bookings
  ADD COLUMN IF NOT EXISTS staff_member_id UUID REFERENCES staff_members(id) ON DELETE SET NULL;

ALTER TABLE meeting_room_bookings
  ADD COLUMN IF NOT EXISTS billing_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_staff_member_id ON meeting_room_bookings(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_billing_user_id ON meeting_room_bookings(billing_user_id);

-- コメントを追加
COMMENT ON COLUMN meeting_room_bookings.staff_member_id IS '予約したスタッフのID（スタッフが予約した場合）';
COMMENT ON COLUMN meeting_room_bookings.billing_user_id IS '決済を行うユーザーID（スタッフの場合は法人ユーザーID）';

