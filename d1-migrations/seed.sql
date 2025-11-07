-- ============================================
-- Room8 Initial Data (D1/SQLite版)
-- 初期データ投入
-- ============================================

-- ============================================
-- 1. Plans (プランデータ)
-- ============================================
-- 起業家プラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('entrepreneur', '起業家プラン', 55000, 
 '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
 '09:00', '22:00',
 '{"type":"shared_office","address_usage":true,"meeting_room":{"free_hours":4,"rate":1100},"printer":true,"company_registration":{"standard":true,"optional_price":5500},"guest_usage":{"free_hours_per_guest":2,"billing_to_representative":true}}',
 1, 1);

-- レギュラープラン  
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('regular', 'レギュラープラン', 19800,
 '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
 '09:00', '22:00',
 '{"type":"shared_office","address_usage":true,"meeting_room":{"free_hours":4,"rate":1100},"printer":true,"company_registration":{"standard":false,"optional_price":5500},"guest_usage":{"free_hours_per_guest":2,"billing_to_representative":true}}',
 2, 1);

-- ライトプラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('light', 'ライトプラン', 16500,
 '["monday","tuesday","wednesday","thursday","friday"]',
 '09:00', '22:00',
 '{"type":"shared_office","address_usage":true,"meeting_room":{"free_hours":4,"rate":1100},"printer":true,"company_registration":{"standard":false,"optional_price":5500},"guest_usage":{"free_hours_per_guest":2,"billing_to_representative":true}}',
 3, 1);

-- フルタイムプラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('fulltime', 'フルタイムプラン', 16500,
 '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
 '09:00', '22:00',
 '{"type":"coworking","address_usage":false,"meeting_room":{"rate":1100},"printer":false,"guest_usage":{"paid":true,"guest_can_pay":true,"representative_can_pay":true}}',
 4, 1);

-- ウィークデイプラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('weekday', 'ウィークデイプラン', 13200,
 '["monday","tuesday","wednesday","thursday","friday"]',
 '09:00', '22:00',
 '{"type":"coworking","address_usage":false,"meeting_room":{"rate":1100},"printer":false,"guest_usage":{"paid":true,"guest_can_pay":true,"representative_can_pay":true}}',
 5, 1);

-- デイタイムプラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('daytime', 'デイタイムプラン', 11000,
 '["monday","tuesday","wednesday","thursday","friday"]',
 '09:00', '17:00',
 '{"type":"coworking","address_usage":false,"meeting_room":{"rate":1100},"printer":false,"guest_usage":{"paid":true,"guest_can_pay":true,"representative_can_pay":true}}',
 6, 1);

-- ナイト&ホリデープラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('night_holiday', 'ナイト&ホリデープラン', 9900,
 '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
 '17:00', '22:00',
 '{"type":"coworking","address_usage":false,"meeting_room":{"rate":1100},"printer":false,"guest_usage":{"paid":true,"guest_can_pay":true,"representative_can_pay":true},"note":"平日17-22時、土日祝9-17時"}',
 7, 1);

-- ナイトプラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('night', 'ナイトプラン', 6600,
 '["monday","tuesday","wednesday","thursday","friday"]',
 '17:00', '22:00',
 '{"type":"coworking","address_usage":false,"meeting_room":{"rate":1100},"printer":false,"guest_usage":{"paid":true,"guest_can_pay":true,"representative_can_pay":true}}',
 8, 1);

-- ホリデープラン
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('holiday', 'ホリデープラン', 6600,
 '["saturday","sunday"]',
 '09:00', '17:00',
 '{"type":"coworking","address_usage":false,"meeting_room":{"rate":1100},"printer":false,"guest_usage":{"paid":true,"guest_can_pay":true,"representative_can_pay":true},"note":"土日祝9-17時"}',
 9, 1);

-- ============================================
-- 2. Meeting Room (会議室データ)
-- ============================================
INSERT INTO meeting_rooms (code, name, capacity, description, hourly_rate_regular, hourly_rate_non_regular, is_active) VALUES
('room8-meeting-room-001', '会議室', 10, 'Room8の会議室です。最大10名までご利用いただけます。', 1100, 2200, 1);
