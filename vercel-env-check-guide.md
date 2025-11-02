# Vercel環境変数確認ガイド

## 🎯 目的

Vercelダッシュボードで、Supabaseの環境変数が正しく設定されているか確認する方法を説明します。

---

## 📝 確認手順

### ステップ1: Vercelダッシュボードを開く

1. **Vercelダッシュボード**にアクセス
   - https://vercel.com にアクセス
   - ログインする

### ステップ2: プロジェクトを選択

1. **ダッシュボードのトップページ**で、プロジェクト一覧を確認
2. **`room8-system`** プロジェクトをクリック

### ステップ3: Settingsを開く

1. プロジェクトページの上部メニューで **「Settings」** をクリック
2. 左側のメニューから **「Environment Variables」** を選択
   - または、Settingsページで **「Environment Variables」** セクションを探す

### ステップ4: 環境変数を確認

**Environment Variables** ページで、以下の環境変数が設定されているか確認：

#### 確認すべき環境変数

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - **Value**: `https://xxxxx.supabase.co` の形式
   - **Environment**: `Production`, `Preview`, `Development` すべてに設定されていることが推奨

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - **Value**: 長い文字列（Supabaseの匿名キー）
   - **Environment**: `Production`, `Preview`, `Development` すべてに設定されていることが推奨

3. **`SUPABASE_SERVICE_ROLE_KEY`**
   - **Value**: 長い文字列（Supabaseのサービスロールキー）
   - **Environment**: `Production`, `Preview`, `Development` すべてに設定されていることが推奨
   - ⚠️ **注意**: このキーは機密情報です。Valueは表示されませんが、設定されているか確認してください

---

## ✅ 確認チェックリスト

### 環境変数の存在確認

- [ ] `NEXT_PUBLIC_SUPABASE_URL` が設定されている ✅
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されている ✅
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が設定されている ✅

### 環境（Environment）の確認

各環境変数について、以下を確認：

- [ ] **Production** に設定されている ✅
- [ ] **Preview** に設定されている ✅（推奨）
- [ ] **Development** に設定されている ✅（推奨）

---

## 🔧 環境変数が設定されていない場合

### 設定方法

1. **Environment Variables** ページで **「Add New」** または **「Add」** ボタンをクリック
2. 以下の情報を入力：

#### 環境変数の追加

1. **Key**: `NEXT_PUBLIC_SUPABASE_URL`
2. **Value**: SupabaseのプロジェクトURL（例: `https://xxxxx.supabase.co`）
3. **Environment**: 
   - `Production` をチェック ✅
   - `Preview` をチェック ✅（推奨）
   - `Development` をチェック ✅（推奨）
4. **「Save」** をクリック

#### 同様に、他の環境変数も追加

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseの匿名キー
- `SUPABASE_SERVICE_ROLE_KEY`: Supabaseのサービスロールキー

---

## 📍 確認場所の画面イメージ

```
Vercelダッシュボード
├─ room8-system プロジェクト
   ├─ Settings
      ├─ General
      ├─ Environment Variables ← ここ！
      ├─ Git
      └─ ...
```

---

## 💡 補足

### 環境変数のValueが表示されない場合

- **`SUPABASE_SERVICE_ROLE_KEY`** など、機密情報の場合は値が表示されません
- これは正常です。設定されているかどうかを確認してください

### 環境変数の取得方法（設定していない場合）

環境変数が設定されていない場合は、Supabaseダッシュボードから取得してください：

1. **Supabaseダッシュボード**を開く
   - https://supabase.com にアクセス
   - ログインする
2. **プロジェクトを選択**
3. **Settings** → **API** を開く
4. 以下の情報を確認：
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL` の値
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` の値
   - **service_role secret**: `SUPABASE_SERVICE_ROLE_KEY` の値

---

## ✅ 次のステップ

環境変数を確認・設定した後：

1. **再デプロイを実行**（環境変数を追加・変更した場合）
2. **デプロイメントのログを確認**（エラーが出ていないか）
3. **サイトが正常に動作するか確認**

---

**Environment Variablesページで、3つの環境変数が正しく設定されているか確認してください！**

