# 環境変数設定一覧

このファイルは、Vercelで設定されている環境変数の一覧を記録しています。

## 📋 設定されている環境変数

### Supabase関連

| 環境変数名 | 用途 | 取得方法 |
|-----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | Supabase Dashboard > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase公開キー（クライアントサイド用） | Supabase Dashboard > Settings > API > `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロールキー（サーバーサイド用、管理者操作に必要） | Supabase Dashboard > Settings > API > `service_role` `secret` key |

**注意**: `SUPABASE_SERVICE_ROLE_KEY`は機密情報です。クライアントサイドでは使用しないでください。

### Stripe関連

| 環境変数名 | 用途 | 取得方法 |
|-----------|------|---------|
| `STRIPE_SECRET_KEY_TEST` | Stripe秘密キー（テスト環境） | Stripe Dashboard > Developers > API keys > Secret key (test mode) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開キー（クライアントサイド用） | Stripe Dashboard > Developers > API keys > Publishable key (test mode) |

### Google Calendar関連

| 環境変数名 | 用途 | 取得方法 |
|-----------|------|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Service Accountのメールアドレス | Google Cloud Console > IAM & Admin > Service Accounts > 作成したService Accountのメールアドレス<br>**またはJSONファイルの`client_email`フィールド** |
| `GOOGLE_PRIVATE_KEY` | Google Service Accountの秘密鍵（JSON形式の`private_key`フィールド） | Google Cloud Console > IAM & Admin > Service Accounts > 作成したService Account > Keys > JSONキーをダウンロードして`private_key`フィールドの値を取得<br>**JSONファイルの`private_key`フィールドをそのまま使用（改行文字`\n`を含む）** |
| `GOOGLE_CALENDAR_ID` | GoogleカレンダーのID（予約管理用） | Google Calendar > 設定 > 共有したいカレンダーの「カレンダーID」を確認（通常は`primary`またはメールアドレス形式） |

**注意**: `GOOGLE_PRIVATE_KEY`は機密情報です。クライアントサイドでは使用しないでください。
**設定方法**: 
1. Google Cloud Consoleでプロジェクトを作成
2. Google Calendar APIを有効化
3. Service Accountを作成し、JSONキーをダウンロード
4. JSONファイルの`client_email`フィールドの値を`GOOGLE_SERVICE_ACCOUNT_EMAIL`に設定
5. JSONファイルの`private_key`フィールドの値を`GOOGLE_PRIVATE_KEY`に設定（改行文字`\n`はそのまま保持、ダブルクォートで囲む）
6. Service Accountのメールアドレスをカレンダーに共有（編集権限を付与）
7. カレンダーIDを`GOOGLE_CALENDAR_ID`に設定

**詳細は** `docs/GOOGLE_CALENDAR_SETUP.md` を参照してください。

## 🔒 セキュリティ注意事項

- **機密情報を含む環境変数**（`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY_TEST`, `GOOGLE_PRIVATE_KEY`）は：
  - サーバーサイド（API Routes）でのみ使用
  - クライアントサイドで使用しない
  - Gitにコミットしない（`.env.local`は`.gitignore`で除外）

- **公開キー**（`NEXT_PUBLIC_*`）は：
  - クライアントサイドで使用可能
  - ブラウザの開発者ツールで確認可能（機密情報ではない）

## 📍 確認方法

環境変数の確認・変更はVercel Dashboardで行います：
1. Vercel Dashboardにログイン
2. プロジェクトを選択
3. Settings > Environment Variables
4. 各環境変数の値を確認・編集

## 📝 更新履歴

- 2025-01-XX: 初期設定完了
  - Supabase関連: 3つの環境変数
  - Stripe関連: 2つの環境変数
- 2025-01-XX: Google Calendar連携追加
  - Google Calendar関連: 3つの環境変数
