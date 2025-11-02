-- Seed data for plans table
-- 9プランの初期データ投入

-- ============================================
-- シェアオフィスプラン（3プラン）
-- ============================================

-- 起業家プラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  '起業家プラン',
  'entrepreneur',
  55000,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  '09:00:00',
  '22:00:00',
  '{
    "type": "shared_office",
    "address_usage": true,
    "meeting_room": {"free_hours": 4, "rate": 1100},
    "printer": true,
    "company_registration": {"standard": true, "optional_price": 5500},
    "guest_usage": {"free_hours_per_guest": 2, "billing_to_representative": true}
  }'::jsonb,
  1
);

-- レギュラープラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'レギュラープラン',
  'regular',
  19800,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  '09:00:00',
  '22:00:00',
  '{
    "type": "shared_office",
    "address_usage": true,
    "meeting_room": {"free_hours": 4, "rate": 1100},
    "printer": true,
    "company_registration": {"standard": false, "optional_price": 5500},
    "guest_usage": {"free_hours_per_guest": 2, "billing_to_representative": true}
  }'::jsonb,
  2
);

-- ライトプラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'ライトプラン',
  'light',
  16500,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  '09:00:00',
  '22:00:00',
  '{
    "type": "shared_office",
    "address_usage": true,
    "meeting_room": {"free_hours": 4, "rate": 1100},
    "printer": true,
    "company_registration": {"standard": false, "optional_price": 5500},
    "guest_usage": {"free_hours_per_guest": 2, "billing_to_representative": true}
  }'::jsonb,
  3
);

-- ============================================
-- ワークスペースプラン（コワーキングスペースプラン）（6プラン）
-- ============================================

-- フルタイムプラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'フルタイムプラン',
  'fulltime',
  16500,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  '09:00:00',
  '22:00:00',
  '{
    "type": "coworking",
    "address_usage": false,
    "meeting_room": {"rate": 1100},
    "printer": false,
    "guest_usage": {"paid": true, "guest_can_pay": true, "representative_can_pay": true}
  }'::jsonb,
  4
);

-- ウィークデイプラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'ウィークデイプラン',
  'weekday',
  13200,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  '09:00:00',
  '22:00:00',
  '{
    "type": "coworking",
    "address_usage": false,
    "meeting_room": {"rate": 1100},
    "printer": false,
    "guest_usage": {"paid": true, "guest_can_pay": true, "representative_can_pay": true}
  }'::jsonb,
  5
);

-- デイタイムプラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'デイタイムプラン',
  'daytime',
  11000,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  '09:00:00',
  '17:00:00',
  '{
    "type": "coworking",
    "address_usage": false,
    "meeting_room": {"rate": 1100},
    "printer": false,
    "guest_usage": {"paid": true, "guest_can_pay": true, "representative_can_pay": true}
  }'::jsonb,
  6
);

-- ナイト&ホリデープラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'ナイト&ホリデープラン',
  'night_holiday',
  9900,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  '17:00:00',
  '22:00:00',
  '{
    "type": "coworking",
    "address_usage": false,
    "meeting_room": {"rate": 1100},
    "printer": false,
    "guest_usage": {"paid": true, "guest_can_pay": true, "representative_can_pay": true},
    "note": "平日17-22時、土日祝9-17時"
  }'::jsonb,
  7
);

-- ナイトプラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'ナイトプラン',
  'night',
  6600,
  ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  '17:00:00',
  '22:00:00',
  '{
    "type": "coworking",
    "address_usage": false,
    "meeting_room": {"rate": 1100},
    "printer": false,
    "guest_usage": {"paid": true, "guest_can_pay": true, "representative_can_pay": true}
  }'::jsonb,
  8
);

-- ホリデープラン
INSERT INTO plans (name, code, price, available_days, start_time, end_time, features, display_order) VALUES
(
  'ホリデープラン',
  'holiday',
  6600,
  ARRAY['saturday', 'sunday'],
  '09:00:00',
  '17:00:00',
  '{
    "type": "coworking",
    "address_usage": false,
    "meeting_room": {"rate": 1100},
    "printer": false,
    "guest_usage": {"paid": true, "guest_can_pay": true, "representative_can_pay": true},
    "note": "土日祝9-17時"
  }'::jsonb,
  9
);

