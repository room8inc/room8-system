-- 古い決済方式のデータをクリーンアップ
-- 古い決済方式（チェックイン時に事前決済）のデータを削除または更新

-- 1. 古い決済方式のデータを確認
-- stripe_payment_intent_idがあるがdropin_feeがnullのもの
-- または、dropin_feeとduration_minutesが両方nullのもの

-- まず、該当データを確認（削除前に確認用）
SELECT 
  id,
  user_id,
  checkin_at,
  checkout_at,
  duration_minutes,
  dropin_fee,
  payment_status,
  stripe_payment_intent_id,
  member_type_at_checkin
FROM checkins
WHERE member_type_at_checkin = 'dropin'
  AND checkout_at IS NOT NULL
  AND payment_status = 'pending'
  AND (
    -- 古い決済方式: stripe_payment_intent_idがあるがdropin_feeがnull
    (stripe_payment_intent_id IS NOT NULL AND dropin_fee IS NULL)
    OR
    -- データ不整合: dropin_feeとduration_minutesが両方null
    (dropin_fee IS NULL AND duration_minutes IS NULL)
  );

-- 2. 古い決済方式のデータを削除（確認後、実行）
-- 注意: このSQLを実行すると、該当データが完全に削除されます
-- 実行前に必ず上記のSELECTで確認してください

-- DELETE FROM checkins
-- WHERE member_type_at_checkin = 'dropin'
--   AND checkout_at IS NOT NULL
--   AND payment_status = 'pending'
--   AND (
--     -- 古い決済方式: stripe_payment_intent_idがあるがdropin_feeがnull
--     (stripe_payment_intent_id IS NOT NULL AND dropin_fee IS NULL)
--     OR
--     -- データ不整合: dropin_feeとduration_minutesが両方null
--     (dropin_fee IS NULL AND duration_minutes IS NULL)
--   );

-- 3. または、料金を計算して更新（duration_minutesがある場合のみ）
-- 注意: このSQLを実行すると、料金が再計算されて更新されます
-- 実行前に必ず上記のSELECTで確認してください

-- UPDATE checkins
-- SET 
--   dropin_fee = LEAST(CEIL(duration_minutes / 60.0) * 400, 2000),
--   stripe_payment_intent_id = NULL
-- WHERE member_type_at_checkin = 'dropin'
--   AND checkout_at IS NOT NULL
--   AND payment_status = 'pending'
--   AND stripe_payment_intent_id IS NOT NULL
--   AND dropin_fee IS NULL
--   AND duration_minutes IS NOT NULL;

