-- Enable RLS for plan_options_stripe_prices table
ALTER TABLE plan_options_stripe_prices ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for plan_options_stripe_prices
-- 認証済みユーザーは読み取り可能
CREATE POLICY "Allow authenticated users to read plan_options_stripe_prices"
  ON plan_options_stripe_prices FOR SELECT
  TO authenticated
  USING (true);

-- 管理者のみ更新可能
CREATE POLICY "Allow admins to manage plan_options_stripe_prices"
  ON plan_options_stripe_prices FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

