-- チェックイン・チェックアウト履歴を全削除
-- 注意: このSQLを実行すると、checkinsテーブルの全データが削除されます

-- 1. 削除前にデータ数を確認
SELECT COUNT(*) as total_checkins FROM checkins;

-- 2. 削除前にデータの概要を確認（オプション）
SELECT 
  member_type_at_checkin,
  payment_status,
  COUNT(*) as count
FROM checkins
GROUP BY member_type_at_checkin, payment_status
ORDER BY member_type_at_checkin, payment_status;

-- 3. 全データを削除
-- 注意: このSQLを実行すると、checkinsテーブルの全データが完全に削除されます
-- 実行前に必ず上記のSELECTで確認してください

DELETE FROM checkins;

-- 4. 削除後の確認
SELECT COUNT(*) as remaining_checkins FROM checkins;

