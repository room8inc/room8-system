# Vercel 環境変数設定ガイド

## 🎯 Supabaseの環境変数をVercelに設定

ローカルの`.env.local`には設定済みですが、Vercelの本番環境にも設定する必要があります。

---

## 📋 設定手順

### 1. Vercelダッシュボードを開く

1. https://vercel.com にアクセス
2. ログイン
3. `room8-system`プロジェクトを選択

### 2. 環境変数を設定

1. **Settings**をクリック
2. **Environment Variables**をクリック
3. 以下の環境変数を追加：

#### 追加する環境変数

**1. Supabase URL**
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://kznytkfhvqfyqdqoast.supabase.co`
- **Environment**: `Production`, `Preview`, `Development` 全てにチェック

**2. Supabase Anon Key**
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6bnl0a2ZodnFmeXNkb3FvYXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMDYzMTMsImV4cCI6MjA3NzU4MjMxM30.iCyzeQlqzRyNpGo9UmgFKteJqCfiLVR2Cn-PF6B15Mc`
- **Environment**: `Production`, `Preview`, `Development` 全てにチェック

**3. Supabase Service Role Key**
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6bnl0a2ZodnFmeXNkb3FvYXN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAwNjMxMywiZXhwIjoyMDc3NTgyMzEzfQ.iWJRT8Wemsv0i59E8vXWr-8VsWjtRReC6j0Ioo8mINc`
- **Environment**: `Production`, `Preview` のみチェック（Developmentには不要）
- ⚠️ **重要**: このキーはサーバー側のみで使用（クライアント側には露出しない）

### 3. 保存後、再デプロイ

1. 全ての環境変数を追加後、「Save」をクリック
2. **Deployments**タブに戻る
3. 最新のデプロイメントの「...」メニューから「Redeploy」をクリック
   - または、新しいコミットをプッシュすると自動的に再デプロイされます

---

## 🔑 環境変数の説明

### NEXT_PUBLIC_SUPABASE_URL
- **用途**: SupabaseプロジェクトのURL
- **公開範囲**: クライアント側でも使用可能（`NEXT_PUBLIC_`プレフィックス）
- **例**: `https://kznytkfhvqfyqdqoast.supabase.co`

### NEXT_PUBLIC_SUPABASE_ANON_KEY
- **用途**: 匿名アクセス用のAPIキー（クライアント側で使用）
- **公開範囲**: クライアント側でも使用可能（`NEXT_PUBLIC_`プレフィックス）
- **セキュリティ**: 公開しても問題ないが、Row Level Security（RLS）で保護

### SUPABASE_SERVICE_ROLE_KEY
- **用途**: サーバー側のみで使用するAPIキー（管理者権限）
- **公開範囲**: サーバー側のみ（クライアント側には露出しない）
- **セキュリティ**: ⚠️ **絶対に公開しない**（RLSをバイパス可能）

---

## ⚠️ 注意事項

### Service Role Keyの取り扱い

- ✅ **サーバー側のみで使用**（API Routes、Server Actionsなど）
- ❌ **クライアント側で使用しない**
- ❌ **Gitにコミットしない**（`.gitignore`で除外済み）
- ❌ **環境変数に`NEXT_PUBLIC_`プレフィックスを付けない**

### 環境変数の確認

- Vercelの環境変数が正しく設定されているか確認
- 再デプロイ後に環境変数が読み込まれているか確認
- ローカル開発環境でも`.env.local`が正しく読み込まれているか確認

---

## ✅ 確認事項

- [ ] Vercelに環境変数を設定完了
- [ ] 再デプロイ実行
- [ ] 環境変数が正しく読み込まれているか確認
- [ ] 次回のコミット・プッシュで自動デプロイが動作するか確認

---

**設定完了後、データベース設計に進みます。**

