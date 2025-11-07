-- Room8 Database Schema (D1/SQLite版)
-- Initial migration for Phase 1 MVP

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
  member_type TEXT NOT NULL CHECK (member_type IN ('regular', 'dropin', 'guest')),
  is_individual INTEGER NOT NULL DEFAULT 1,
  company_name TEXT,
  id_document_url TEXT,
  company_registry_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_member_type ON users(member_type);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- 2. plans (プランテーブル)
-- ============================================
CREATE TABLE plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  price INTEGER NOT NULL,
  available_days TEXT NOT NULL, -- JSON配列
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  features TEXT, -- JSON
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for plans
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for user_plans
CREATE INDEX idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX idx_user_plans_plan_id ON user_plans(plan_id);
CREATE INDEX idx_user_plans_status ON user_plans(status);
CREATE INDEX idx_user_plans_user_status ON user_plans(user_id, status);

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
  venue_id TEXT NOT NULL,
  is_overtime INTEGER DEFAULT 0,
  overtime_minutes INTEGER,
  dropin_fee INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for checkins
CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_checkin_at ON checkins(checkin_at);
CREATE INDEX idx_checkins_checkout_at ON checkins(checkout_at);
CREATE INDEX idx_checkins_user_checkout ON checkins(user_id, checkout_at);

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

-- Indexes for lockers
CREATE INDEX idx_lockers_locker_number ON lockers(locker_number);
CREATE INDEX idx_lockers_user_id ON lockers(user_id);
CREATE INDEX idx_lockers_status ON lockers(status);

-- ============================================
-- Trigger: Update updated_at timestamp
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

