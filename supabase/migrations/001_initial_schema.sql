-- Room8 Database Schema
-- Initial migration for Phase 1 MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. users (ユーザー/会員テーブル)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  phone TEXT,
  address TEXT,
  member_type TEXT NOT NULL CHECK (member_type IN ('regular', 'dropin', 'guest')),
  is_individual BOOLEAN NOT NULL DEFAULT true,
  company_name TEXT,
  id_document_url TEXT,
  company_registry_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_member_type ON users(member_type);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- 2. plans (プランテーブル)
-- ============================================
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  price INTEGER NOT NULL,
  available_days TEXT[] NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for plans
CREATE INDEX idx_plans_code ON plans(code);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- ============================================
-- 3. user_plans (会員プラン履歴テーブル)
-- ============================================
CREATE TABLE user_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  started_at DATE NOT NULL,
  ended_at DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'changed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_at TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  member_type_at_checkin TEXT NOT NULL CHECK (member_type_at_checkin IN ('regular', 'dropin', 'guest')),
  plan_id_at_checkin UUID REFERENCES plans(id) ON DELETE SET NULL,
  venue_id TEXT NOT NULL,
  is_overtime BOOLEAN DEFAULT false,
  overtime_minutes INTEGER,
  dropin_fee INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for checkins
CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_checkin_at ON checkins(checkin_at);
CREATE INDEX idx_checkins_checkout_at ON checkins(checkout_at);
CREATE INDEX idx_checkins_user_checkout ON checkins(user_id, checkout_at) WHERE checkout_at IS NULL;

-- ============================================
-- 5. lockers (ロッカーテーブル)
-- ============================================
CREATE TABLE lockers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locker_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for lockers
CREATE INDEX idx_lockers_locker_number ON lockers(locker_number);
CREATE INDEX idx_lockers_user_id ON lockers(user_id);
CREATE INDEX idx_lockers_status ON lockers(status);

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_plans_updated_at BEFORE UPDATE ON user_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checkins_updated_at BEFORE UPDATE ON checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lockers_updated_at BEFORE UPDATE ON lockers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

