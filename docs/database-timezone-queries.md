# データベース時刻表示クエリ（日本時間変換）

Supabaseのデータベースでは、`TIMESTAMP WITH TIME ZONE`型のカラムはUTC時刻で保存されています。直接確認する際は、日本時間（JST）に変換する必要があります。

## よく使うクエリ

### チェックイン履歴を日本時間で表示

```sql
SELECT 
  id,
  user_id,
  -- 日本時間に変換して表示
  checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkin_at_jst,
  checkout_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkout_at_jst,
  duration_minutes,
  member_type_at_checkin
FROM checkins
ORDER BY checkin_at DESC
LIMIT 20;
```

### 今日のチェックインを日本時間で表示

```sql
SELECT 
  id,
  user_id,
  -- 日本時間に変換
  checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkin_at_jst,
  checkout_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkout_at_jst,
  duration_minutes
FROM checkins
WHERE 
  -- 今日の日本時間でフィルタ
  checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' >= CURRENT_DATE
ORDER BY checkin_at DESC;
```

### 座席チェックイン履歴を日本時間で表示

```sql
SELECT 
  sc.id,
  sc.user_id,
  s.seat_number,
  s.seat_name,
  -- 日本時間に変換
  sc.checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkin_at_jst,
  sc.checkout_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkout_at_jst
FROM seat_checkins sc
JOIN seats s ON sc.seat_id = s.id
ORDER BY sc.checkin_at DESC
LIMIT 20;
```

### 現在チェックイン中のユーザー（日本時間で表示）

```sql
SELECT 
  c.id,
  u.name,
  u.email,
  -- 日本時間に変換
  c.checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkin_at_jst,
  -- 経過時間（分）
  EXTRACT(EPOCH FROM (NOW() - c.checkin_at)) / 60 AS elapsed_minutes
FROM checkins c
JOIN users u ON c.user_id = u.id
WHERE c.checkout_at IS NULL
ORDER BY c.checkin_at DESC;
```

### 会議室予約を日本時間で表示

```sql
SELECT 
  id,
  user_id,
  booking_date,
  start_time,
  end_time,
  status,
  -- 作成日時を日本時間で表示
  created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS created_at_jst
FROM meeting_room_bookings
ORDER BY booking_date DESC, start_time DESC
LIMIT 20;
```

## 便利な関数（オプション）

Supabaseでよく使う場合は、ビューを作成することもできます：

```sql
-- チェックイン履歴ビュー（日本時間）
CREATE OR REPLACE VIEW checkins_jst AS
SELECT 
  id,
  user_id,
  checkin_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkin_at_jst,
  checkout_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' AS checkout_at_jst,
  duration_minutes,
  member_type_at_checkin,
  plan_id_at_checkin,
  venue_id,
  is_overtime,
  overtime_minutes,
  overtime_fee,
  dropin_fee,
  payment_status
FROM checkins;

-- 使用例
SELECT * FROM checkins_jst ORDER BY checkin_at_jst DESC LIMIT 10;
```

## 注意点

- PostgreSQLの`AT TIME ZONE`構文を使用しています
- `'UTC'`から`'Asia/Tokyo'`への変換で、UTC+9時間（日本時間）になります
- 夏時間（サマータイム）は考慮されません（日本はサマータイムなし）

## タイムゾーン変換の仕組み

```sql
-- UTC時刻を日本時間に変換
timestamp_column AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo'

-- 例：
-- 2025-11-13 11:50:48.826+00 (UTC)
-- → 2025-11-13 20:50:48.826 (JST, UTC+9)
```

