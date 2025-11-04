-- Create meeting rooms and bookings tables
-- Phase 1: 会議室予約機能のためのテーブル

-- ============================================
-- 1. meeting_rooms (会議室テーブル)
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  hourly_rate_regular INTEGER NOT NULL DEFAULT 1100, -- 定額会員（一般）の料金
  hourly_rate_non_regular INTEGER NOT NULL DEFAULT 2200, -- 定額会員以外の料金
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for meeting_rooms
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_code ON meeting_rooms(code);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_is_active ON meeting_rooms(is_active);

-- ============================================
-- 2. meeting_room_bookings (会議室予約テーブル)
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_room_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_room_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL(5,2) NOT NULL, -- 予約時間（時間単位、例: 1.5, 2.0）
  number_of_participants INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'in_use', 'completed', 'cancelled')),
  member_type_at_booking TEXT NOT NULL, -- 予約時の会員種別
  plan_id_at_booking UUID REFERENCES plans(id), -- 予約時のプランID（定額会員の場合）
  is_shared_office_plan BOOLEAN DEFAULT false, -- シェアオフィスプランかどうか
  hourly_rate INTEGER NOT NULL, -- 予約時の時間単価（円）
  total_amount INTEGER NOT NULL, -- 予約時の合計金額（円）
  free_hours_used DECIMAL(5,2) DEFAULT 0, -- 無料枠使用時間（シェアオフィスプランの場合）
  actual_start_time TIMESTAMP WITH TIME ZONE, -- 実際の利用開始時刻
  actual_end_time TIMESTAMP WITH TIME ZONE, -- 実際の利用終了時刻
  actual_duration_hours DECIMAL(5,2), -- 実際の利用時間（時間単位）
  notes TEXT, -- 備考
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for meeting_room_bookings
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_meeting_room_id ON meeting_room_bookings(meeting_room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_user_id ON meeting_room_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_booking_date ON meeting_room_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_status ON meeting_room_bookings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_date_time ON meeting_room_bookings(booking_date, start_time, end_time);
-- 空き状況確認用のインデックス（予約日、開始時刻、終了時刻、ステータス）
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_availability ON meeting_room_bookings(meeting_room_id, booking_date, start_time, end_time, status);

-- ============================================
-- 3. Update trigger for updated_at
-- ============================================
CREATE TRIGGER update_meeting_rooms_updated_at
  BEFORE UPDATE ON meeting_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_room_bookings_updated_at
  BEFORE UPDATE ON meeting_room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Insert initial meeting room data (1室のみ)
-- ============================================
INSERT INTO meeting_rooms (name, code, capacity, description, hourly_rate_regular, hourly_rate_non_regular)
VALUES (
  '会議室',
  'room8-meeting-room-001',
  10,
  'Room8の会議室です。最大10名までご利用いただけます。',
  1100,
  2200
)
ON CONFLICT (code) DO NOTHING;

