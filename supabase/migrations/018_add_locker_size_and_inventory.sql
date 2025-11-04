-- Add locker size and initialize locker inventory
-- Phase 1 MVP: ロッカーのサイズ管理と在庫管理

-- ============================================
-- lockersテーブルにsizeカラムを追加
-- ============================================
ALTER TABLE lockers
  ADD COLUMN IF NOT EXISTS size TEXT CHECK (size IN ('large', 'small'));

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_lockers_size ON lockers(size);
CREATE INDEX IF NOT EXISTS idx_lockers_size_status ON lockers(size, status);

-- ============================================
-- 初期ロッカー在庫を作成
-- ============================================
-- 大ロッカー: 5個
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO lockers (locker_number, size, status)
    VALUES (
      'L-' || LPAD(i::TEXT, 3, '0'),  -- L-001, L-002, ..., L-005
      'large',
      'available'
    )
    ON CONFLICT (locker_number) DO NOTHING;
  END LOOP;
END $$;

-- 小ロッカー: 18個
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..18 LOOP
    INSERT INTO lockers (locker_number, size, status)
    VALUES (
      'S-' || LPAD(i::TEXT, 3, '0'),  -- S-001, S-002, ..., S-018
      'small',
      'available'
    )
    ON CONFLICT (locker_number) DO NOTHING;
  END LOOP;
END $$;

-- コメント追加
COMMENT ON COLUMN lockers.size IS 'ロッカーのサイズ: large（大）またはsmall（小）';

