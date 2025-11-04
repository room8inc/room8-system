-- Add RLS policies for meeting rooms tables
-- Phase 1: 会議室予約機能のためのポリシー

-- ============================================
-- meeting_rooms テーブルのポリシー
-- ============================================

-- Enable RLS
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;

-- ポリシー1: 全員が会議室情報を閲覧できる
DROP POLICY IF EXISTS "Allow public read access to meeting rooms" ON meeting_rooms;
CREATE POLICY "Allow public read access to meeting rooms"
  ON meeting_rooms FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- meeting_room_bookings テーブルのポリシー
-- ============================================

-- Enable RLS
ALTER TABLE meeting_room_bookings ENABLE ROW LEVEL SECURITY;

-- ポリシー1: 認証済みユーザーは自分の予約をINSERTできる
DROP POLICY IF EXISTS "Allow authenticated users to insert their own bookings" ON meeting_room_bookings;
CREATE POLICY "Allow authenticated users to insert their own bookings"
  ON meeting_room_bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ポリシー2: 認証済みユーザーは自分の予約をSELECTできる
DROP POLICY IF EXISTS "Allow users to read their own bookings" ON meeting_room_bookings;
CREATE POLICY "Allow users to read their own bookings"
  ON meeting_room_bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ポリシー3: 認証済みユーザーは自分の予約をUPDATEできる（キャンセルなど）
DROP POLICY IF EXISTS "Allow users to update their own bookings" ON meeting_room_bookings;
CREATE POLICY "Allow users to update their own bookings"
  ON meeting_room_bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ポリシー4: 空き状況確認のため、全ユーザーが予約情報を閲覧できる（予約日時のみ）
-- 注意: 個人情報は含まれないため、全ユーザーが閲覧可能
DROP POLICY IF EXISTS "Allow authenticated users to read bookings for availability check" ON meeting_room_bookings;
CREATE POLICY "Allow authenticated users to read bookings for availability check"
  ON meeting_room_bookings FOR SELECT
  TO authenticated
  USING (true);

-- 注意: 管理者が全予約情報を閲覧・管理する場合は、別途管理者用のポリシーを追加する必要があります
-- Phase 1-4（管理画面実装時）に追加予定

