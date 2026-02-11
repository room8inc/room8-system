-- ============================================
-- 056: グループプラン機能
--
-- 目的:
--   家族/法人向けのグループプラン。
--   複数人を登録し、契約スロット数まで同時利用可能。
--   2人目以降50% OFF。登録者以外は利用不可。
--   オーナーのプランを超えるプランには契約不可。
-- ============================================

BEGIN;

-- ============================================
-- 1. group_plans: グループ本体
-- ============================================

CREATE TABLE group_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  group_type TEXT NOT NULL CHECK (group_type IN ('family', 'corporate')),
  contract_term TEXT NOT NULL DEFAULT 'monthly',
  payment_method TEXT NOT NULL DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_plans_owner ON group_plans(owner_user_id);
CREATE INDEX idx_group_plans_status ON group_plans(status);

CREATE TRIGGER update_group_plans_updated_at BEFORE UPDATE ON group_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. group_slots: 契約スロット（各自にプランが紐付く）
-- ============================================

CREATE TABLE group_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  plan_id UUID NOT NULL REFERENCES plans(id),
  plan_type TEXT NOT NULL DEFAULT 'workspace' CHECK (plan_type IN ('workspace', 'shared_office')),
  options JSONB DEFAULT '{}',
  stripe_subscription_item_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_plan_id, slot_number)
);

CREATE INDEX idx_group_slots_group_plan ON group_slots(group_plan_id);

CREATE TRIGGER update_group_slots_updated_at BEFORE UPDATE ON group_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. group_members: 登録メンバー（この人だけがチェックイン可能）
-- ============================================

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_plan_id, user_id)
);

CREATE INDEX idx_group_members_group_plan ON group_members(group_plan_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TRIGGER update_group_members_updated_at BEFORE UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. checkins テーブルに追加カラム
--    どのグループのどのスロットで入店したか
-- ============================================

ALTER TABLE checkins
  ADD COLUMN group_plan_id UUID REFERENCES group_plans(id),
  ADD COLUMN group_slot_id UUID REFERENCES group_slots(id);

CREATE INDEX idx_checkins_group_plan ON checkins(group_plan_id) WHERE group_plan_id IS NOT NULL;
CREATE INDEX idx_checkins_group_slot ON checkins(group_slot_id) WHERE group_slot_id IS NOT NULL;

-- ============================================
-- 5. RLS ポリシー
-- ============================================

-- group_plans
ALTER TABLE group_plans ENABLE ROW LEVEL SECURITY;

-- オーナー/メンバーは自分のグループをSELECT可能
CREATE POLICY "group_plans_select_member"
  ON group_plans FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR id IN (
      SELECT group_plan_id FROM group_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR public.is_admin_user() = true
  );

-- 管理者はALL
CREATE POLICY "group_plans_admin_all"
  ON group_plans FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- group_slots
ALTER TABLE group_slots ENABLE ROW LEVEL SECURITY;

-- グループメンバーはSELECT可能
CREATE POLICY "group_slots_select_member"
  ON group_slots FOR SELECT
  TO authenticated
  USING (
    group_plan_id IN (
      SELECT group_plan_id FROM group_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR public.is_admin_user() = true
  );

-- 管理者はALL
CREATE POLICY "group_slots_admin_all"
  ON group_slots FOR ALL
  TO authenticated
  USING (public.is_admin_user() = true)
  WITH CHECK (public.is_admin_user() = true);

-- group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- 自分のメンバーシップ＋同グループメンバーをSELECT
CREATE POLICY "group_members_select"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR group_plan_id IN (
      SELECT group_plan_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
    OR public.is_admin_user() = true
  );

-- owner/adminはINSERT/UPDATE/DELETE
CREATE POLICY "group_members_owner_admin_insert"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    group_plan_id IN (
      SELECT group_plan_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin') AND gm.status = 'active'
    )
    OR public.is_admin_user() = true
  );

CREATE POLICY "group_members_owner_admin_update"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    group_plan_id IN (
      SELECT group_plan_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin') AND gm.status = 'active'
    )
    OR public.is_admin_user() = true
  )
  WITH CHECK (
    group_plan_id IN (
      SELECT group_plan_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin') AND gm.status = 'active'
    )
    OR public.is_admin_user() = true
  );

CREATE POLICY "group_members_owner_admin_delete"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    group_plan_id IN (
      SELECT group_plan_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin') AND gm.status = 'active'
    )
    OR public.is_admin_user() = true
  );

COMMIT;
