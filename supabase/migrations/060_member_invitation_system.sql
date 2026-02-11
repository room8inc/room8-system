-- メンバー招待機能: user_plansに招待元カラムを追加
-- 個人契約がベース。メイン会員がメンバーを招待し、50% OFFで利用可能にする。

-- 招待元ユーザーID（NULL=通常の個人契約、NOT NULL=誰かに招待されたメンバー）
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id);

-- 適用された割引コード（例: 'group_50off'）
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS discount_code TEXT;

-- インデックス: ホストが自分の招待メンバーを検索するため
CREATE INDEX IF NOT EXISTS idx_user_plans_invited_by
  ON user_plans(invited_by) WHERE invited_by IS NOT NULL;

-- RLSポリシー: ホストが自分の招待メンバーのプランをSELECTできるように
-- （既存の "Allow users to read their own plans" は auth.uid() = user_id のみ）
-- PostgreSQLではSELECTポリシーはOR結合されるため、追加するだけでOK
CREATE POLICY "Allow host to read invited members plans"
  ON user_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = invited_by);
