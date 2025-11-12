-- Room8 Seat Management System
-- Migration: Create seats and seat_checkins tables

-- ============================================
-- 1. seats (座席情報テーブル)
-- ============================================
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seat_number TEXT UNIQUE NOT NULL, -- 座席番号（例: "A-1", "B-1"）
  seat_name TEXT, -- 座席名（オプション）
  seat_type TEXT NOT NULL CHECK (seat_type IN ('free_space', 'meeting_room')), -- 座席タイプ
  position_x INTEGER, -- 座席表でのX座標（オプション）
  position_y INTEGER, -- 座席表でのY座標（オプション）
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'disabled')), -- 座席ステータス
  notes TEXT, -- メモ
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for seats
CREATE INDEX idx_seats_seat_number ON seats(seat_number);
CREATE INDEX idx_seats_seat_type ON seats(seat_type);
CREATE INDEX idx_seats_status ON seats(status);

-- ============================================
-- 2. seat_checkins (座席チェックイン履歴テーブル)
-- ============================================
CREATE TABLE seat_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES checkins(id) ON DELETE CASCADE, -- 会場のチェックインと紐付け
  checkin_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  checkout_at TIMESTAMP WITH TIME ZONE, -- 座席からのチェックアウト時刻
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for seat_checkins
CREATE INDEX idx_seat_checkins_user_id ON seat_checkins(user_id);
CREATE INDEX idx_seat_checkins_seat_id ON seat_checkins(seat_id);
CREATE INDEX idx_seat_checkins_checkin_id ON seat_checkins(checkin_id);
CREATE INDEX idx_seat_checkins_checkout_at ON seat_checkins(checkout_at);
CREATE INDEX idx_seat_checkins_active ON seat_checkins(seat_id, checkout_at) WHERE checkout_at IS NULL;

-- 部分UNIQUEインデックス: 1ユーザーが1座席に同時にチェックインできないように制約
CREATE UNIQUE INDEX idx_seat_checkins_unique_active ON seat_checkins(user_id, seat_id) WHERE checkout_at IS NULL;

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================
CREATE TRIGGER update_seats_updated_at BEFORE UPDATE ON seats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seat_checkins_updated_at BEFORE UPDATE ON seat_checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE seats IS '座席情報テーブル。フリースペース座席と会議室座席を管理';
COMMENT ON TABLE seat_checkins IS '座席チェックイン履歴テーブル。会場のチェックインと紐付け';
COMMENT ON COLUMN seats.seat_type IS '座席タイプ: free_space（フリースペース）, meeting_room（会議室）';
COMMENT ON COLUMN seat_checkins.checkin_id IS '会場のチェックイン（checkinsテーブル）と紐付け。会場にチェックインしていないと座席にチェックインできない';

