# 座席管理システム デプロイ後チェックリスト

## ✅ 必須確認項目

### 1. マイグレーションの実行確認

**Supabaseダッシュボードで以下を確認：**

1. **テーブル作成の確認**
   - `seats` テーブルが存在するか
   - `seat_checkins` テーブルが存在するか
   - インデックスが正しく作成されているか

2. **初期データ投入の確認**
   - `supabase/migrations/051_seed_seats.sql` を実行
   - 以下のSQLで座席数が27席（フリースペース19席 + 会議室8席）であることを確認：
   ```sql
   SELECT seat_type, COUNT(*) as count 
   FROM seats 
   GROUP BY seat_type;
   ```
   - 期待値：
     - `free_space`: 19席
     - `meeting_room`: 8席

### 2. APIエンドポイントの動作確認

**Postmanやcurlで以下をテスト：**

#### 2-1. 座席チェックインAPI (`POST /api/seats/checkin`)

**前提条件：**
- 会場にチェックインしている必要がある

**テスト手順：**
1. 会場にチェックイン（QRコードスキャン）
2. 座席チェックインAPIを呼び出し：
   ```bash
   curl -X POST https://your-domain.com/api/seats/checkin \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{"seatId": "座席ID（UUID）"}'
   ```

**確認ポイント：**
- ✅ 会場にチェックインしていない場合、エラーが返る
- ✅ 座席が既に使用されている場合、エラーが返る
- ✅ 会議室座席で予約がある場合、エラーが返る
- ✅ 正常にチェックインできる

#### 2-2. 座席チェックアウトAPI (`POST /api/seats/checkout`)

**テスト手順：**
1. 座席にチェックイン済みの状態で
2. 座席チェックアウトAPIを呼び出し：
   ```bash
   curl -X POST https://your-domain.com/api/seats/checkout \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{"seatId": "座席ID（UUID）"}'
   ```

**確認ポイント：**
- ✅ 座席にチェックインしていない場合、エラーが返る
- ✅ 正常にチェックアウトできる
- ✅ `seat_checkins`テーブルの`checkout_at`が更新される

### 3. 会場チェックアウト時の自動解除機能

**テスト手順：**
1. 会場にチェックイン
2. 座席にチェックイン
3. 会場からチェックアウト（QRコードスキャン）

**確認ポイント：**
- ✅ 会場チェックアウト時に、座席も自動的にチェックアウトされる
- ✅ `seat_checkins`テーブルの`checkout_at`が更新される
- ✅ 座席が空き状態に戻る

**確認SQL：**
```sql
-- 会場チェックアウト後、座席チェックアウトも完了しているか確認
SELECT 
  sc.id,
  sc.checkin_id,
  sc.checkout_at,
  c.checkout_at as venue_checkout_at
FROM seat_checkins sc
JOIN checkins c ON sc.checkin_id = c.id
WHERE c.checkout_at IS NOT NULL
  AND sc.checkout_at IS NULL;  -- これが0件であることを確認
```

### 4. 会議室座席の予約チェック機能

**テスト手順：**
1. 会議室を予約（現在時刻を含む時間帯）
2. 会場にチェックイン
3. 会議室座席（MR-1〜MR-8）にチェックインを試みる

**確認ポイント：**
- ✅ 会議室予約がある時間帯は、会議室座席にチェックインできない
- ✅ エラーメッセージ「会議室が予約されているため、座席を利用できません」が返る

**確認SQL：**
```sql
-- 現在時刻に会議室予約があるか確認
SELECT * 
FROM meeting_room_bookings 
WHERE booking_date = CURRENT_DATE
  AND status IN ('reserved', 'confirmed', 'in_use')
  AND start_time <= CURRENT_TIME
  AND end_time > CURRENT_TIME;
```

### 5. RLS（Row Level Security）ポリシーの確認

**Supabaseダッシュボードで以下を確認：**

1. **`seats`テーブルのRLS**
   - RLSが有効になっているか
   - 全ユーザーが読み取り可能か（座席一覧表示のため）

2. **`seat_checkins`テーブルのRLS**
   - RLSが有効になっているか
   - ユーザーが自分の座席チェックイン情報を読み取り・作成・更新できるか

**確認SQL：**
```sql
-- RLSが有効か確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('seats', 'seat_checkins');

-- ポリシーが存在するか確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('seats', 'seat_checkins');
```

## ⚠️ トラブルシューティング

### エラー: "座席情報が見つかりません"
- `seats`テーブルに初期データが投入されているか確認
- マイグレーション `051_seed_seats.sql` が実行されているか確認

### エラー: "会場にチェックインしている必要があります"
- 会場のチェックインが完了しているか確認
- `checkins`テーブルに`checkout_at`が`NULL`のレコードがあるか確認

### エラー: "この座席は既に使用されています"
- `seat_checkins`テーブルで`checkout_at`が`NULL`のレコードがないか確認
- 座席が正しくチェックアウトされているか確認

### 座席チェックアウトが自動解除されない
- `components/qr-scanner-modal.tsx`と`app/checkin/page.tsx`の変更がデプロイされているか確認
- ブラウザのコンソールでエラーが出ていないか確認

## 📝 次のステップ

- [ ] 座席表UIコンポーネントの実装（ダッシュボードに追加）
- [ ] 座席管理機能（管理画面で座席の追加・編集・削除）

