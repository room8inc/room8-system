-- Enable Row Level Security (RLS) on all tables
-- Phase 1 MVP: RLSを有効にする（ポリシーは後で実装）

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on plans table
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_plans table
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Enable RLS on checkins table
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Enable RLS on lockers table
ALTER TABLE lockers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 基本的なRLSポリシー（Phase 1用）
-- 注意: これは一時的なポリシーです。認証機能実装後に適切なポリシーを設定してください
-- ============================================

-- plansテーブル: 全員が読み取り可能（公開データ）
CREATE POLICY "Allow public read access on plans"
  ON plans FOR SELECT
  USING (true);

-- その他のテーブルは一旦すべて拒否
-- 認証機能実装後に適切なポリシーを設定します
-- users: 認証ユーザーのみアクセス可能
-- user_plans: 自分のプラン情報のみアクセス可能
-- checkins: 自分のチェックイン情報のみアクセス可能
-- lockers: 管理者のみアクセス可能

