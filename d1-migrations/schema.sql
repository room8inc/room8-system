-- ============================================
-- Room8 Database Schema (D1/SQLite版)
-- 統合スキーマ - 全テーブル定義
-- ============================================

-- ============================================
-- 1. users (ユーザー/会員テーブル)
-- ============================================
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  phone TEXT,
  address TEXT,
  member_type TEXT CHECK (member_type IN ('regular', 'dropin', 'guest')),
  is_individual INTEGER NOT NULL DEFAULT 1,
  company_name TEXT,
  id_document_url TEXT,
  company_registry_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_staff INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_member_type ON users(member_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = 1;
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- ============================================
-- 2. plans (プランテーブル)
-- ============================================
CREATE TABLE plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  price INTEGER NOT NULL,
  available_days TEXT NOT NULL, -- JSON配列 ["monday", "tuesday"...]
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  features TEXT, -- JSON
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_plans_code ON plans(code);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- ============================================
-- 3. user_plans (会員プラン履歴テーブル)
-- ============================================
CREATE TABLE user_plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'changed')),
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  entry_fee INTEGER DEFAULT 11000,
  entry_fee_discount INTEGER DEFAULT 0,
  first_month_free INTEGER DEFAULT 0,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX idx_user_plans_plan_id ON user_plans(plan_id);
CREATE INDEX idx_user_plans_status ON user_plans(status);
CREATE INDEX idx_user_plans_user_status ON user_plans(user_id, status);
CREATE INDEX idx_user_plans_campaign_id ON user_plans(campaign_id);
CREATE INDEX idx_user_plans_stripe_payment_intent_id ON user_plans(stripe_payment_intent_id);
CREATE INDEX idx_user_plans_stripe_subscription_id ON user_plans(stripe_subscription_id);

-- ============================================
-- 4. checkins (チェックイン/チェックアウトログテーブル)
-- ============================================
CREATE TABLE checkins (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_at TEXT NOT NULL,
  checkout_at TEXT,
  duration_minutes INTEGER,
  member_type_at_checkin TEXT NOT NULL CHECK (member_type_at_checkin IN ('regular', 'dropin', 'guest')),
  plan_id_at_checkin TEXT REFERENCES plans(id) ON DELETE SET NULL,
  staff_member_id TEXT REFERENCES staff_members(id) ON DELETE SET NULL,
  venue_id TEXT NOT NULL,
  is_overtime INTEGER DEFAULT 0,
  overtime_minutes INTEGER,
  dropin_fee INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_checkin_at ON checkins(checkin_at);
CREATE INDEX idx_checkins_checkout_at ON checkins(checkout_at);
CREATE INDEX idx_checkins_user_checkout ON checkins(user_id, checkout_at);
CREATE INDEX idx_checkins_staff_member_id ON checkins(staff_member_id);

-- ============================================
-- 5. lockers (ロッカーテーブル)
-- ============================================
CREATE TABLE lockers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  locker_number TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lockers_locker_number ON lockers(locker_number);
CREATE INDEX idx_lockers_user_id ON lockers(user_id);
CREATE INDEX idx_lockers_status ON lockers(status);

-- ============================================
-- 6. meeting_rooms (会議室テーブル)
-- ============================================
CREATE TABLE meeting_rooms (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  hourly_rate_regular INTEGER NOT NULL DEFAULT 1100,
  hourly_rate_non_regular INTEGER NOT NULL DEFAULT 2200,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meeting_rooms_code ON meeting_rooms(code);
CREATE INDEX idx_meeting_rooms_is_active ON meeting_rooms(is_active);

-- ============================================
-- 7. meeting_room_bookings (会議室予約テーブル)
-- ============================================
CREATE TABLE meeting_room_bookings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  meeting_room_id TEXT NOT NULL REFERENCES meeting_rooms(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_hours REAL NOT NULL,
  number_of_participants INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'in_use', 'completed', 'cancelled')),
  member_type_at_booking TEXT NOT NULL,
  plan_id_at_booking TEXT REFERENCES plans(id),
  is_shared_office_plan INTEGER DEFAULT 0,
  hourly_rate INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  free_hours_used REAL DEFAULT 0,
  actual_start_time TEXT,
  actual_end_time TEXT,
  actual_duration_hours REAL,
  notes TEXT,
  staff_member_id TEXT REFERENCES staff_members(id) ON DELETE SET NULL,
  billing_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  google_calendar_event_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_date TEXT,
  billing_month TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meeting_room_bookings_meeting_room_id ON meeting_room_bookings(meeting_room_id);
CREATE INDEX idx_meeting_room_bookings_user_id ON meeting_room_bookings(user_id);
CREATE INDEX idx_meeting_room_bookings_booking_date ON meeting_room_bookings(booking_date);
CREATE INDEX idx_meeting_room_bookings_status ON meeting_room_bookings(status);
CREATE INDEX idx_meeting_room_bookings_date_time ON meeting_room_bookings(booking_date, start_time, end_time);
CREATE INDEX idx_meeting_room_bookings_availability ON meeting_room_bookings(meeting_room_id, booking_date, start_time, end_time, status);
CREATE INDEX idx_meeting_room_bookings_staff_member_id ON meeting_room_bookings(staff_member_id);
CREATE INDEX idx_meeting_room_bookings_billing_user_id ON meeting_room_bookings(billing_user_id);
CREATE INDEX idx_meeting_room_bookings_google_calendar_event_id ON meeting_room_bookings(google_calendar_event_id);
CREATE INDEX idx_meeting_room_bookings_stripe_payment_intent_id ON meeting_room_bookings(stripe_payment_intent_id);
CREATE INDEX idx_meeting_room_bookings_payment_status ON meeting_room_bookings(payment_status);
CREATE INDEX idx_meeting_room_bookings_billing_month ON meeting_room_bookings(billing_month);
CREATE INDEX idx_meeting_room_bookings_billing_user_pending ON meeting_room_bookings(billing_user_id, payment_status, billing_month) WHERE payment_status = 'pending';

-- ============================================
-- 8. campaigns (キャンペーンテーブル)
-- ============================================
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('entry_fee_50off', 'entry_fee_free', 'first_month_free', 'entry_fee_custom')),
  discount_rate INTEGER,
  applicable_plan_ids TEXT, -- JSON配列
  started_at TEXT NOT NULL,
  ended_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_campaigns_campaign_type ON campaigns(campaign_type);
CREATE INDEX idx_campaigns_is_active ON campaigns(is_active);
CREATE INDEX idx_campaigns_dates ON campaigns(started_at, ended_at);
CREATE INDEX idx_campaigns_active_dates ON campaigns(is_active, started_at, ended_at) WHERE is_active = 1;

-- ============================================
-- 9. staff_members (スタッフテーブル)
-- ============================================
CREATE TABLE staff_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  company_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_kana TEXT,
  email TEXT,
  phone TEXT,
  auth_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_staff_members_company_user_id ON staff_members(company_user_id);
CREATE INDEX idx_staff_members_status ON staff_members(status);
CREATE INDEX idx_staff_members_auth_user_id ON staff_members(auth_user_id);

-- ============================================
-- 10. google_calendar_settings (Googleカレンダー設定テーブル)
-- ============================================
CREATE TABLE google_calendar_settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_google_calendar_settings_active ON google_calendar_settings(is_active) WHERE is_active = 1;

-- ============================================
-- 11. google_oauth_tokens (Google OAuth認証トークンテーブル)
-- ============================================
CREATE TABLE google_oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 12. google_calendar_events_cache (Googleカレンダーイベントキャッシュテーブル)
-- ============================================
CREATE TABLE google_calendar_events_cache (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  summary TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, calendar_id)
);

CREATE INDEX idx_google_calendar_events_cache_dates ON google_calendar_events_cache(start_time, end_time);
CREATE INDEX idx_google_calendar_events_cache_calendar_id ON google_calendar_events_cache(calendar_id);
CREATE INDEX idx_google_calendar_events_cache_event_id ON google_calendar_events_cache(event_id);

-- ============================================
-- 13. google_calendar_watch_channels (GoogleカレンダーWatchチャンネル管理テーブル)
-- ============================================
CREATE TABLE google_calendar_watch_channels (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  calendar_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_google_calendar_watch_channels_calendar_id ON google_calendar_watch_channels(calendar_id);
CREATE INDEX idx_google_calendar_watch_channels_expiration ON google_calendar_watch_channels(expiration);

-- ============================================
-- Triggers: Update updated_at timestamp
-- ============================================
CREATE TRIGGER update_users_updated_at 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_plans_updated_at 
AFTER UPDATE ON plans
BEGIN
  UPDATE plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_plans_updated_at 
AFTER UPDATE ON user_plans
BEGIN
  UPDATE user_plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_checkins_updated_at 
AFTER UPDATE ON checkins
BEGIN
  UPDATE checkins SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_lockers_updated_at 
AFTER UPDATE ON lockers
BEGIN
  UPDATE lockers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_meeting_rooms_updated_at 
AFTER UPDATE ON meeting_rooms
BEGIN
  UPDATE meeting_rooms SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_meeting_room_bookings_updated_at 
AFTER UPDATE ON meeting_room_bookings
BEGIN
  UPDATE meeting_room_bookings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_campaigns_updated_at 
AFTER UPDATE ON campaigns
BEGIN
  UPDATE campaigns SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_staff_members_updated_at 
AFTER UPDATE ON staff_members
BEGIN
  UPDATE staff_members SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_google_calendar_settings_updated_at 
AFTER UPDATE ON google_calendar_settings
BEGIN
  UPDATE google_calendar_settings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_google_oauth_tokens_updated_at 
AFTER UPDATE ON google_oauth_tokens
BEGIN
  UPDATE google_oauth_tokens SET updated_at = datetime('now') WHERE id = NEW.id;
END;
