-- Add Stripe PriceID columns to plans table
-- Phase 2: 決済機能実装のためのPriceIDマッピング

-- ============================================
-- plansテーブルにPriceIDカラムを追加
-- ============================================
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_annual_prepaid TEXT;

-- インデックス追加（PriceID検索用）
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_id_monthly ON plans(stripe_price_id_monthly);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_id_yearly ON plans(stripe_price_id_yearly);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price_id_annual_prepaid ON plans(stripe_price_id_annual_prepaid);

-- コメント追加
COMMENT ON COLUMN plans.stripe_price_id_monthly IS 'Stripe PriceID（月契約）';
COMMENT ON COLUMN plans.stripe_price_id_yearly IS 'Stripe PriceID（年契約）';
COMMENT ON COLUMN plans.stripe_price_id_annual_prepaid IS 'Stripe PriceID（年一括前払い）';

-- ============================================
-- テスト環境用PriceIDを設定（作成されたPriceID）
-- ============================================
UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPewmRZuHLNbQd4L6v1IadB',
  stripe_price_id_yearly = 'price_1SPewnRZuHLNbQd4WSAWaMmU',
  stripe_price_id_annual_prepaid = 'price_1SPewoRZuHLNbQd4akIRrTHd'
WHERE code = 'entrepreneur';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPewqRZuHLNbQd40y5Umick',
  stripe_price_id_yearly = 'price_1SPewqRZuHLNbQd4OrWPeGPb',
  stripe_price_id_annual_prepaid = 'price_1SPewrRZuHLNbQd4IaKD7XM4'
WHERE code = 'regular';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPewsRZuHLNbQd48oINvpnb',
  stripe_price_id_yearly = 'price_1SPewtRZuHLNbQd4hwwGf1ag',
  stripe_price_id_annual_prepaid = 'price_1SPewuRZuHLNbQd4KgGPO9j3'
WHERE code = 'light';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPewvRZuHLNbQd4AT7CMhst',
  stripe_price_id_yearly = 'price_1SPewwRZuHLNbQd4vAgbejrj',
  stripe_price_id_annual_prepaid = 'price_1SPewxRZuHLNbQd4lfgiBKb6'
WHERE code = 'fulltime';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPewyRZuHLNbQd4HD3DNtEY',
  stripe_price_id_yearly = 'price_1SPewzRZuHLNbQd4fhbj2CSE',
  stripe_price_id_annual_prepaid = 'price_1SPex0RZuHLNbQd47QeFf4nJ'
WHERE code = 'weekday';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPex1RZuHLNbQd4KKZ00D0Y',
  stripe_price_id_yearly = 'price_1SPex2RZuHLNbQd4hd1kQsUu',
  stripe_price_id_annual_prepaid = 'price_1SPex3RZuHLNbQd4ktuwjyUd'
WHERE code = 'night_holiday';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPex4RZuHLNbQd4w4qYnLmQ',
  stripe_price_id_yearly = 'price_1SPex5RZuHLNbQd47ucSrcgH',
  stripe_price_id_annual_prepaid = 'price_1SPex5RZuHLNbQd4inFbrHxD'
WHERE code = 'daytime';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPex6RZuHLNbQd4Vr1kGxyM',
  stripe_price_id_yearly = 'price_1SPex7RZuHLNbQd4TRDOj30p',
  stripe_price_id_annual_prepaid = 'price_1SPex9RZuHLNbQd49d2yOHoy'
WHERE code = 'holiday';

UPDATE plans SET
  stripe_price_id_monthly = 'price_1SPex9RZuHLNbQd4i4Ipu0kO',
  stripe_price_id_yearly = 'price_1SPexARZuHLNbQd4onCapK4k',
  stripe_price_id_annual_prepaid = 'price_1SPexBRZuHLNbQd4WCfE8e6x'
WHERE code = 'night';

-- ============================================
-- オプション用PriceIDテーブルを作成
-- ============================================
CREATE TABLE IF NOT EXISTS plan_options_stripe_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_name TEXT NOT NULL UNIQUE,
  option_code TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_plan_options_stripe_prices_option_code ON plan_options_stripe_prices(option_code);
CREATE INDEX IF NOT EXISTS idx_plan_options_stripe_prices_stripe_price_id ON plan_options_stripe_prices(stripe_price_id);

-- コメント追加
COMMENT ON TABLE plan_options_stripe_prices IS 'オプション用Stripe PriceIDマッピングテーブル';
COMMENT ON COLUMN plan_options_stripe_prices.option_name IS 'オプション名（日本語）';
COMMENT ON COLUMN plan_options_stripe_prices.option_code IS 'オプションコード（システム用）';
COMMENT ON COLUMN plan_options_stripe_prices.stripe_price_id IS 'Stripe PriceID';

-- オプション用PriceIDを設定
INSERT INTO plan_options_stripe_prices (option_name, option_code, stripe_price_id, price) VALUES
  ('24時間利用', 'twenty_four_hours', 'price_1SPexCRZuHLNbQd4LoXHhmuA', 5500),
  ('プリンター利用', 'printer', 'price_1SPexDRZuHLNbQd4JQxzdzmK', 1100),
  ('法人登記', 'company_registration', 'price_1SPexERZuHLNbQd49vT0hbfC', 5500),
  ('ロッカー大', 'locker_large', 'price_1SPexERZuHLNbQd4Dhey5R11', 4950),
  ('ロッカー小', 'locker_small', 'price_1SPexFRZuHLNbQd4pxw79LnK', 2200)
ON CONFLICT (option_code) DO UPDATE SET
  stripe_price_id = EXCLUDED.stripe_price_id,
  price = EXCLUDED.price,
  updated_at = NOW();

