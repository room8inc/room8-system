# Vercel環境変数設定ガイド（完全版）

## 🚨 状況

- **Environment Variablesページ**は表示されている ✅
- しかし、3つの環境変数が**設定されていない** ❌

**解決方法：環境変数を追加する**

---

## ✅ 設定手順（詳細）

### ステップ1: 環境変数の値を取得（Supabaseダッシュボード）

まず、Supabaseから環境変数の値を取得する必要があります。

1. **Supabaseダッシュボード**を開く
   - https://supabase.com にアクセス
   - ログインする

2. **プロジェクトを選択**
   - Room8のSupabaseプロジェクトを選択

3. **Settings** → **API** を開く
   - 左メニューから「Settings」をクリック
   - 「API」をクリック

4. **以下の情報を確認・コピー**

#### A. Project URL
- **表示名**: "Project URL"
- **値**: `https://xxxxx.supabase.co` の形式
- **用途**: `NEXT_PUBLIC_SUPABASE_URL` の値

#### B. anon public
- **表示名**: "anon public" または "anon key"
- **値**: 長い文字列（`eyJhbGc...` のような形式）
- **用途**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` の値
- **「Reveal」**ボタンをクリックして値を表示

#### C. service_role secret
- **表示名**: "service_role secret" または "service_role key"
- **値**: 長い文字列（`eyJhbGc...` のような形式）
- **用途**: `SUPABASE_SERVICE_ROLE_KEY` の値
- **「Reveal」**ボタンをクリックして値を表示

---

### ステップ2: Vercelで環境変数を設定

1. **Vercelダッシュボード**の**Environment Variablesページ**に戻る
   - 既に開いているはずです

2. **「Create new」タブ**が選択されていることを確認
   - 左上に「Create new」と「Link Shared Environment Variables」のタブがある
   - **「Create new」タブ**が選択されていることを確認（青い下線がある）

#### A. NEXT_PUBLIC_SUPABASE_URL を設定

1. **Key**フィールドに以下を入力：
   ```
   NEXT_PUBLIC_SUPABASE_URL
   ```

2. **Value**フィールドに以下を入力：
   - Supabaseダッシュボードから取得した**Project URL**
   - 例: `https://xxxxx.supabase.co`

3. **Environments**ドロップダウンをクリック
   - **以下をすべてチェック** ✅:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

4. **「Add Another」**ボタンをクリック
   - または、次の環境変数を設定するために準備

#### B. NEXT_PUBLIC_SUPABASE_ANON_KEY を設定

1. **Key**フィールドに以下を入力：
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. **Value**フィールドに以下を入力：
   - Supabaseダッシュボードから取得した**anon public**の値
   - 長い文字列をそのままコピー&ペースト

3. **Environments**ドロップダウンをクリック
   - **以下をすべてチェック** ✅:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

4. **「Add Another」**ボタンをクリック
   - または、次の環境変数を設定するために準備

#### C. SUPABASE_SERVICE_ROLE_KEY を設定

1. **Key**フィールドに以下を入力：
   ```
   SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Value**フィールドに以下を入力：
   - Supabaseダッシュボードから取得した**service_role secret**の値
   - 長い文字列をそのままコピー&ペースト
   - ⚠️ **重要**: このキーは機密情報です。誤って公開しないように注意してください

3. **Environments**ドロップダウンをクリック
   - **以下をすべてチェック** ✅:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

4. **「Sensitive」トグルを有効にする**（推奨）
   - このキーは機密情報のため、「Sensitive」を有効にすると値が非表示になります

---

### ステップ3: 環境変数を保存

1. **3つの環境変数がすべて設定されていることを確認**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **画面右下の「Save」ボタンをクリック**
   - 環境変数が保存されます

---

## ✅ 確認チェックリスト

### Supabaseダッシュボードから取得

- [ ] Project URLをコピー ✅
- [ ] anon publicの値をコピー ✅
- [ ] service_role secretの値をコピー ✅

### Vercelで設定

- [ ] `NEXT_PUBLIC_SUPABASE_URL` を設定 ✅
  - [ ] Key: `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] Value: SupabaseのProject URL
  - [ ] Environments: Production, Preview, Development すべてにチェック ✅
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定 ✅
  - [ ] Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] Value: Supabaseのanon publicの値
  - [ ] Environments: Production, Preview, Development すべてにチェック ✅
- [ ] `SUPABASE_SERVICE_ROLE_KEY` を設定 ✅
  - [ ] Key: `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] Value: Supabaseのservice_role secretの値
  - [ ] Environments: Production, Preview, Development すべてにチェック ✅
  - [ ] Sensitiveトグルを有効にする（推奨）✅
- [ ] **「Save」ボタンをクリック** ✅

---

## 🔄 保存後の次のステップ

### 環境変数を保存した後

1. **再デプロイを実行**
   - 環境変数を追加・変更した場合は、新しいデプロイが必要です
   - Deploymentsタブから最新のデプロイメントを再デプロイ

2. **デプロイメントのログを確認**
   - ビルドログでエラーが出ていないか確認
   - 環境変数が正しく読み込まれているか確認

3. **サイトが正常に動作するか確認**
   - デプロイが完了したら、サイトを確認

---

## 💡 補足

### 環境変数の取得場所（再確認）

**Supabaseダッシュボード**:
- Settings → API
- **Project URL**: `NEXT_PUBLIC_SUPABASE_URL` の値
- **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` の値
- **service_role secret**: `SUPABASE_SERVICE_ROLE_KEY` の値

### Sensitiveオプションについて

- **SUPABASE_SERVICE_ROLE_KEY**は機密情報のため、「Sensitive」を有効にすることを推奨
- 有効にすると、値が非表示になり、誤って公開されるリスクを軽減

---

## 🎯 次のステップ

1. **Supabaseダッシュボードから環境変数の値を取得**
2. **Vercelで3つの環境変数を設定**
3. **「Save」ボタンをクリック**
4. **再デプロイを実行**

---

**まず、Supabaseダッシュボードから環境変数の値を取得してから、Vercelで設定してください！**

