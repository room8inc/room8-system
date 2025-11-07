-- Seed Plans Data (D1/SQLite版)

-- 9つの定期会員プランを投入
INSERT INTO plans (code, name, price, available_days, start_time, end_time, features, display_order, is_active) VALUES
('weekday-9-18', '平日デイタイム', 13200, '["monday","tuesday","wednesday","thursday","friday"]', '09:00', '18:00', '{"type":"coworking"}', 1, 1),
('weekday-9-22', '平日フルタイム', 19800, '["monday","tuesday","wednesday","thursday","friday"]', '09:00', '22:00', '{"type":"coworking"}', 2, 1),
('all-9-18', '全日デイタイム', 16500, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '09:00', '18:00', '{"type":"coworking"}', 3, 1),
('all-9-22', '全日フルタイム', 24200, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '09:00', '22:00', '{"type":"coworking"}', 4, 1),
('night-18-22', 'ナイトタイム', 9900, '["monday","tuesday","wednesday","thursday","friday"]', '18:00', '22:00', '{"type":"coworking"}', 5, 1),
('weekend-9-22', 'ホリデー', 11000, '["saturday","sunday"]', '09:00', '22:00', '{"type":"coworking"}', 6, 1),
('shared-office-1', 'シェアオフィスプラン（1名）', 33000, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '09:00', '22:00', '{"type":"shared_office","seats":1,"meeting_room_free_hours":4}', 7, 1),
('shared-office-2', 'シェアオフィスプラン（2名）', 55000, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '09:00', '22:00', '{"type":"shared_office","seats":2,"meeting_room_free_hours":4}', 8, 1),
('shared-office-3', 'シェアオフィスプラン（3名）', 77000, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '09:00', '22:00', '{"type":"shared_office","seats":3,"meeting_room_free_hours":4}', 9, 1);

