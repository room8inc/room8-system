-- Seed data for seats table
-- 座席の初期データ投入
-- フリースペース: 19席（7席 + 8席 + 4席）
-- 会議室座席: 8席

-- ============================================
-- フリースペース座席（19席）
-- ============================================

-- Aエリア（7席）
INSERT INTO seats (seat_number, seat_name, seat_type, status) VALUES
('A-1', 'A-1', 'free_space', 'active'),
('A-2', 'A-2', 'free_space', 'active'),
('A-3', 'A-3', 'free_space', 'active'),
('A-4', 'A-4', 'free_space', 'active'),
('A-5', 'A-5', 'free_space', 'active'),
('A-6', 'A-6', 'free_space', 'active'),
('A-7', 'A-7', 'free_space', 'active');

-- Bエリア（8席）
INSERT INTO seats (seat_number, seat_name, seat_type, status) VALUES
('B-1', 'B-1', 'free_space', 'active'),
('B-2', 'B-2', 'free_space', 'active'),
('B-3', 'B-3', 'free_space', 'active'),
('B-4', 'B-4', 'free_space', 'active'),
('B-5', 'B-5', 'free_space', 'active'),
('B-6', 'B-6', 'free_space', 'active'),
('B-7', 'B-7', 'free_space', 'active'),
('B-8', 'B-8', 'free_space', 'active');

-- Cエリア（4席）
INSERT INTO seats (seat_number, seat_name, seat_type, status) VALUES
('C-1', 'C-1', 'free_space', 'active'),
('C-2', 'C-2', 'free_space', 'active'),
('C-3', 'C-3', 'free_space', 'active'),
('C-4', 'C-4', 'free_space', 'active');

-- ============================================
-- 会議室座席（8席）
-- ============================================

INSERT INTO seats (seat_number, seat_name, seat_type, status) VALUES
('MR-1', '会議室-1', 'meeting_room', 'active'),
('MR-2', '会議室-2', 'meeting_room', 'active'),
('MR-3', '会議室-3', 'meeting_room', 'active'),
('MR-4', '会議室-4', 'meeting_room', 'active'),
('MR-5', '会議室-5', 'meeting_room', 'active'),
('MR-6', '会議室-6', 'meeting_room', 'active'),
('MR-7', '会議室-7', 'meeting_room', 'active'),
('MR-8', '会議室-8', 'meeting_room', 'active');

