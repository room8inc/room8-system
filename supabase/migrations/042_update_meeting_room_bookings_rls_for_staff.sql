-- Update RLS policy for meeting_room_bookings to allow staff members to read their bookings
-- 利用者ユーザーがstaff_member_id経由で予約を取得できるようにする

-- ポリシー2を更新: 認証済みユーザーは自分の予約をSELECTできる（user_idまたはstaff_member_id経由）
DROP POLICY IF EXISTS "Allow users to read their own bookings" ON meeting_room_bookings;
CREATE POLICY "Allow users to read their own bookings"
  ON meeting_room_bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM staff_members 
      WHERE staff_members.id = meeting_room_bookings.staff_member_id 
      AND staff_members.auth_user_id = auth.uid()
    )
  );

-- ポリシー3を更新: 認証済みユーザーは自分の予約をUPDATEできる（user_idまたはstaff_member_id経由）
DROP POLICY IF EXISTS "Allow users to update their own bookings" ON meeting_room_bookings;
CREATE POLICY "Allow users to update their own bookings"
  ON meeting_room_bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM staff_members 
      WHERE staff_members.id = meeting_room_bookings.staff_member_id 
      AND staff_members.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM staff_members 
      WHERE staff_members.id = meeting_room_bookings.staff_member_id 
      AND staff_members.auth_user_id = auth.uid()
    )
  );

