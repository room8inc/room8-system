# 055_redesign_plans.sql デプロイチェックリスト

## SQLレビュー結果

### レビュー概要

055_redesign_plans.sql は「プラン・料金構造の再設計」マイグレーションです。
既存のplansテーブルに新カラムを追加し、バンドル・オプション・ドロップイン・割引の各テーブルを新設します。

**結論: デプロイ可能。重大な問題なし。**

### 確認済み事項

| 項目 | 結果 | 詳細 |
|------|------|------|
| 非破壊性 | OK | 既存カラムのDROP/ALTER TYPEなし。ADD COLUMNのみ |
| トランザクション | OK | BEGIN/COMMIT で囲まれている |
| RLSポリシー | OK | 全新テーブルにENABLE RLS + SELECT(認証ユーザー) + ALL(管理者) |
| is_admin_user() | OK | 016で定義済みのSECURITY DEFINER関数を参照 |
| updated_atトリガー | OK | 全新テーブルにupdate_updated_at_column()トリガー設定済み |
| uuid_generate_v4() | OK | 001で CREATE EXTENSION IF NOT EXISTS "uuid-ossp" 済み |
| 外部キー制約 | OK | user_plans.bundle_id → bundles(id) 正しく設定 |
| インデックス | OK | bundle_id, plan_type にインデックスあり |

### 料金データの検証

#### plans テーブルの新カラム値

| プラン | code | workspace_price | shared_office_price | room8-knowledge.md | 一致 |
|--------|------|-----------------|---------------------|--------------------|------|
| レギュラー | regular | 16,500 | 19,800 | 16,500 / 19,800 | OK |
| ウィークデイ | weekday | 13,200 | 16,500 | 13,200 / 16,500 | OK |
| デイタイム | daytime | 11,000 | 14,300 | 11,000 / 14,300 | OK |
| ナイト&ホリデー | night_holiday | 9,900 | 13,200 | 9,900 / 13,200 | OK |
| ナイト | night | 6,600 | 9,900 | 6,600 / 9,900 | OK |
| ホリデー | holiday | 6,600 | 9,900 | 6,600 / 9,900 | OK |

**注意: 起業家プラン(code='entrepreneur')とフルタイムプラン(code='fulltime')のworkspace_price/shared_office_priceがレギュラーと同じ(16,500/19,800)に設定されている。**

- 起業家プラン: 旧priceは55,000。これはバンドル価格。分解するとレギュラーのシェアオフィス(19,800)がベース → workspace_price=16,500, shared_office_price=19,800は正しい
- フルタイムプラン: 旧priceは16,500。workspace_price=16,500はレギュラーと同値で正しい（全営業時間利用）

#### 時間帯の検証

| プラン | weekday_start | weekday_end | weekend_start | weekend_end | room8-knowledge.md | 一致 |
|--------|---------------|-------------|---------------|-------------|---------------------|------|
| レギュラー/フルタイム | 09:00 | 22:00 | 09:00 | 17:00 | 全営業時間 | OK |
| ウィークデイ | 09:00 | 22:00 | NULL | NULL | 平日 9:00-22:00 | OK |
| デイタイム | 09:00 | 17:00 | NULL | NULL | 平日 9:00-17:00 | OK |
| ナイト&ホリデー | 17:00 | 22:00 | 09:00 | 17:00 | 平日17-22時+土日祝9-17時 | OK |
| ナイト | 17:00 | 22:00 | NULL | NULL | 平日 17:00-22:00 | OK |
| ホリデー | NULL | NULL | 09:00 | 17:00 | 土日祝 9:00-17:00 | OK |

#### plan_options テーブル

| オプション | code | price(055) | room8-knowledge.md | 一致 |
|------------|------|------------|---------------------|------|
| シェアオフィス | shared_office | 3,300 | +3,300円（差額） | OK |
| 法人登記 | company_registration | 5,500 | 5,500円 | OK |
| 24時間利用 | twenty_four_hours | 5,500 | 5,500円 | OK |
| ロッカー大 | locker_large | 4,950 | 4,950円 | OK |
| ロッカー小 | locker_small | 2,750 | 2,750円 | OK |
| プリンター使い放題 | printer | 1,100 | 1,100円 | OK |

**注: 旧テーブル(024)のロッカー小は2,200円だったが、055で2,750円に修正済み（正しい値）**

#### dropin_rates テーブル

| rate_type | amount | room8-knowledge.md | 一致 |
|-----------|--------|---------------------|------|
| hourly | 420 | 420円 | OK |
| daily_max | 2,200 | 2,200円 | OK |

#### discount_rules テーブル

| code | discount_value | room8-knowledge.md | 一致 |
|------|----------------|---------------------|------|
| yearly_contract | 20% | 20%OFF | OK |
| annual_prepaid | 30% | 30%OFF | OK |
| group_second | 50% | 50%OFF | OK |

#### bundles テーブル（起業家パック）

| 項目 | 値 | room8-knowledge.md | 一致 |
|------|-----|---------------------|------|
| price | 55,000 | 55,000円/月 | OK |
| included_plan_code | regular | レギュラープラン | OK |
| included_plan_type | shared_office | +シェアオフィス | OK |
| included_options | twenty_four_hours, company_registration, locker_large | +24時間+法人登記+ロッカー大 | OK |
| extra_features | web_production: true | +Web制作サポート | OK |

### 軽微な注意点

1. **Stripe Price ID は全てNULL**: 新カラム(stripe_price_id_ws_monthly等)にはデフォルト値なし。Stripe管理画面で作成後、手動でUPDATEが必要。
2. **plan_options.stripe_price_id のコピー**: 旧テーブル(plan_options_stripe_prices)からcode一致分をコピーするが、旧テーブルにはshared_officeコードが存在しないため、新plan_optionsのshared_officeのstripe_price_idはNULLになる。これは想定通り。
3. **user_plans.plan_type の推定埋め**: 起業家・レギュラー・ライトをshared_officeに設定。これは旧体系での分類に基づいており妥当。ただし起業家プランは055以降bundlesテーブルで管理されるため、既存の起業家プラン契約者のplan_typeは過渡的な値。
4. **旧plan_options_stripe_pricesテーブルは残存**: リネームも削除もしない。コード側で新plan_optionsテーブルに参照を切り替える必要がある。

---

## デプロイ手順

### Phase 1: 事前確認

- [ ] **1.1** Supabase Dashboard にログインし、接続可能なことを確認
- [ ] **1.2** 本番のplansテーブルに9レコード存在することを確認:
  ```sql
  SELECT code, name, price FROM plans ORDER BY display_order;
  ```
  期待値: entrepreneur, regular, light, fulltime, weekday, daytime, night_holiday, night, holiday
- [ ] **1.3** plan_options_stripe_pricesテーブルの現在のデータを確認:
  ```sql
  SELECT option_code, option_name, price, stripe_price_id FROM plan_options_stripe_prices;
  ```
- [ ] **1.4** user_plansテーブルの現在のアクティブ契約数を記録:
  ```sql
  SELECT count(*), plan_id FROM user_plans WHERE status = 'active' GROUP BY plan_id;
  ```
- [ ] **1.5** Vercelの現在のデプロイ状態を確認（正常動作していること）
- [ ] **1.6** 本番DBのバックアップを取得（Supabase Dashboard > Database > Backups）

### Phase 2: マイグレーション実行

- [ ] **2.1** Supabase Dashboard > SQL Editor を開く
- [ ] **2.2** 055_redesign_plans.sql の内容をコピー&ペースト
- [ ] **2.3** **実行前に最終確認**: BEGIN/COMMITで囲まれていることを確認
- [ ] **2.4** SQL を実行（Run ボタン）
- [ ] **2.5** エラーがないことを確認

### Phase 3: マイグレーション後の検証

- [ ] **3.1** plansテーブルに新カラムが追加されたことを確認:
  ```sql
  SELECT code, name, workspace_price, shared_office_price,
         weekday_start_time, weekday_end_time,
         weekend_start_time, weekend_end_time
  FROM plans ORDER BY display_order;
  ```
- [ ] **3.2** bundlesテーブルにデータが入っていることを確認:
  ```sql
  SELECT * FROM bundles;
  ```
  期待値: 1レコード（起業家プラン、code='entrepreneur'、price=55000）
- [ ] **3.3** plan_optionsテーブルにデータが入っていることを確認:
  ```sql
  SELECT name, code, price, stripe_price_id FROM plan_options ORDER BY display_order;
  ```
  期待値: 6レコード（shared_office, company_registration, twenty_four_hours, locker_large, locker_small, printer）
- [ ] **3.4** dropin_ratesテーブルにデータが入っていることを確認:
  ```sql
  SELECT * FROM dropin_rates;
  ```
  期待値: 2レコード（hourly=420, daily_max=2200）
- [ ] **3.5** discount_rulesテーブルにデータが入っていることを確認:
  ```sql
  SELECT * FROM discount_rules;
  ```
  期待値: 3レコード（yearly_contract=20%, annual_prepaid=30%, group_second=50%）
- [ ] **3.6** user_plansテーブルのplan_typeが埋まっていることを確認:
  ```sql
  SELECT up.plan_type, p.code, count(*)
  FROM user_plans up JOIN plans p ON up.plan_id = p.id
  WHERE up.status = 'active'
  GROUP BY up.plan_type, p.code;
  ```
- [ ] **3.7** RLSポリシーが正しく設定されていることを確認:
  ```sql
  SELECT tablename, policyname FROM pg_policies
  WHERE tablename IN ('bundles', 'plan_options', 'dropin_rates', 'discount_rules')
  ORDER BY tablename;
  ```
  期待値: 各テーブルに SELECT(authenticated) + ALL(admin) の2ポリシー

### Phase 4: コードデプロイ

- [ ] **4.1** ローカルで最終テスト（`npm run build` が成功すること）
- [ ] **4.2** 変更をステージング:
  ```bash
  git add -A
  git commit -m "feat: プラン・料金構造の再設計（055マイグレーション）"
  git push origin main
  ```
- [ ] **4.3** Vercel Dashboard でビルドが成功することを確認
- [ ] **4.4** デプロイ完了後、本番URLにアクセスして基本動作確認

### Phase 5: デプロイ後の動作確認

- [ ] **5.1** プラン選択画面が正しく表示されるか
  - 6プランが表示される
  - ワークスペース/シェアオフィスの切り替えが動作する
  - 各プランの料金が正しい
- [ ] **5.2** プラン契約フローが完了するか（テスト環境で）
- [ ] **5.3** チェックイン/チェックアウトが正常に動作するか
  - 既存会員のチェックインが壊れていないこと
  - 時間帯の判定が新カラム(weekday_start_time等)を正しく参照しているか
- [ ] **5.4** LINE Botのプラン診断が正しい料金を返すか
  - ドロップイン料金: 420円/h, 上限2,200円
  - 各プラン料金が正しいこと
- [ ] **5.5** 管理画面が正常に動作するか
  - 会員一覧が表示される
  - プラン情報が正しく表示される

### Phase 6: Stripe Price ID の手動設定（別タスク）

> このフェーズは055マイグレーション直後に行う必要はない。
> Stripe管理画面でPrice IDを作成後に実施する。

- [ ] **6.1** Stripe管理画面で新料金体系のPriceを作成:
  - 各プラン x ワークスペース/シェアオフィス x 月契約/年契約/年一括 = 最大36個
  - 各オプション = 最大6個
  - 各バンドル x 月契約/年契約/年一括 = 最大3個
- [ ] **6.2** 作成したPrice IDをDBにUPDATE:
  ```sql
  -- 例: レギュラープラン ワークスペース月契約
  UPDATE plans SET stripe_price_id_ws_monthly = 'price_xxx' WHERE code = 'regular';
  -- 例: シェアオフィスオプション
  UPDATE plan_options SET stripe_price_id = 'price_xxx' WHERE code = 'shared_office';
  -- 例: 起業家パック
  UPDATE bundles SET stripe_price_id_monthly = 'price_xxx' WHERE code = 'entrepreneur';
  ```

---

## ロールバック手順

055は非破壊的マイグレーションのため、ロールバックは比較的安全に行える。

### DBロールバック

```sql
BEGIN;

-- 1. 外部キー制約を先に削除
ALTER TABLE user_plans DROP CONSTRAINT IF EXISTS fk_user_plans_bundle_id;

-- 2. インデックス削除
DROP INDEX IF EXISTS idx_user_plans_bundle_id;
DROP INDEX IF EXISTS idx_user_plans_plan_type;

-- 3. user_plansの新カラム削除
ALTER TABLE user_plans DROP COLUMN IF EXISTS plan_type;
ALTER TABLE user_plans DROP COLUMN IF EXISTS bundle_id;

-- 4. 新テーブル削除（依存関係の順番に注意）
DROP TABLE IF EXISTS discount_rules CASCADE;
DROP TABLE IF EXISTS dropin_rates CASCADE;
DROP TABLE IF EXISTS plan_options CASCADE;
DROP TABLE IF EXISTS bundles CASCADE;

-- 5. plansテーブルの新カラム削除
ALTER TABLE plans DROP COLUMN IF EXISTS workspace_price;
ALTER TABLE plans DROP COLUMN IF EXISTS shared_office_price;
ALTER TABLE plans DROP COLUMN IF EXISTS weekday_start_time;
ALTER TABLE plans DROP COLUMN IF EXISTS weekday_end_time;
ALTER TABLE plans DROP COLUMN IF EXISTS weekend_start_time;
ALTER TABLE plans DROP COLUMN IF EXISTS weekend_end_time;
ALTER TABLE plans DROP COLUMN IF EXISTS stripe_price_id_ws_monthly;
ALTER TABLE plans DROP COLUMN IF EXISTS stripe_price_id_ws_yearly;
ALTER TABLE plans DROP COLUMN IF EXISTS stripe_price_id_ws_annual_prepaid;
ALTER TABLE plans DROP COLUMN IF EXISTS stripe_price_id_so_monthly;
ALTER TABLE plans DROP COLUMN IF EXISTS stripe_price_id_so_yearly;
ALTER TABLE plans DROP COLUMN IF EXISTS stripe_price_id_so_annual_prepaid;

COMMIT;
```

### コードロールバック

```bash
# 直前のコミットに戻す（push済みの場合）
git revert HEAD
git push origin main
```

---

## デプロイ順序のまとめ

```
1. DBバックアップ取得
2. 055_redesign_plans.sql を Supabase SQL Editor で実行
3. 検証クエリで全テーブルのデータ確認
4. コードをgit push（Vercel自動デプロイ）
5. 本番で動作確認
6. (後日) Stripe Price ID を手動設定
```

**重要: DBマイグレーション(手順2-3)をコードデプロイ(手順4)より先に行うこと。**
コードが新カラム/テーブルを参照するため、DB側が先に準備されている必要がある。
逆に、055は新カラムを追加するだけで既存カラムを変更しないため、
マイグレーション実行後に旧コードが動いても問題ない（非破壊的）。
