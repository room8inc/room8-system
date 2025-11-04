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

## 🔒 セキュリティ注意事項

- **機密情報を含む環境変数**（`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY_TEST`）は：
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
