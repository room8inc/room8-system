# Vercel設定の完全確認ガイド

## 🚨 エラー

```
Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.
```

**このエラーが出る原因：**
1. **Root Directory設定が間違っている**
2. **Framework Preset設定が正しく保存されていない**
3. **プロジェクト設定とデプロイ設定が不一致**

---

## ✅ 完全な確認手順

### 1. Vercelダッシュボードで設定を完全確認

**Settings → General を開いて、以下を確認：**

#### A. Framework Settings
- **Framework Preset**: `Next.js` になっているか？
- もし別の値（`Other`や空白）になっていたら：
  1. ドロップダウンをクリック
  2. `Next.js`を選択
  3. 「OK」または「Save」をクリック

#### B. Build & Development Settings
- **Root Directory**: `./` または **空白（空欄）** になっているか？
- もし `app` や `src` など別の値が入っていたら：
  1. フィールドをクリック
  2. **空白にする**（削除）
  3. または `./` を入力
  4. 「Save」をクリック

#### C. Git Settings
- **Production Branch**: `main` になっているか？
- **Auto-deploy**: `Yes` になっているか？

---

### 2. 設定を保存した後

**重要：設定を変更したら：**
1. **必ず「Save」ボタンをクリック**
2. ページをリロードして、設定が保存されているか確認
3. **再デプロイを実行**

---

### 3. 再デプロイ方法

#### 方法1: 手動で再デプロイ（推奨）
1. **Deployments**タブを開く
2. 最新のデプロイメントをクリック
3. 「...」メニューから**「Redeploy」**をクリック
4. **「Use existing Build Cache」のチェックを外す**（重要）
5. **「Redeploy」**をクリック

#### 方法2: 新しいコミットをプッシュ
新しいコミットをプッシュすると自動デプロイが開始されます。

---

## 🔍 確認チェックリスト

### Vercel設定（Settings → General）
- [ ] **Framework Preset**: `Next.js` ✅
- [ ] **Root Directory**: `./` または **空白** ✅
- [ ] **Production Branch**: `main` ✅
- [ ] **設定を保存した**（Saveをクリック）✅
- [ ] **ページをリロードして、設定が保存されていることを確認** ✅

### 再デプロイ
- [ ] 再デプロイを実行
- [ ] 「Use existing Build Cache」のチェックを外す
- [ ] ビルドログを確認

### ビルドログで確認
- [ ] `Cloning github.com/room8inc/room8-system` と表示される
- [ ] `Installing dependencies...` と表示される
- [ ] `next`が検出される（エラーが出ない）
- [ ] `Build completed successfully` と表示される

---

## 🎯 もしまだエラーが出る場合

### 方法A: プロジェクトを再インポート（最後の手段）

1. **Settings** → **General** を開く
2. **Delete Project**をクリック（⚠️ 慎重に）
3. 新しいプロジェクトとして再インポート：
   - 「Add New...」→「Project」をクリック
   - GitHubリポジトリから`room8inc/room8-system`を選択
   - **Framework Preset**: `Next.js`を選択
   - **Root Directory**: 空白（空欄）のまま
   - **Deploy**をクリック

### 方法B: Vercel CLIで確認（上級者向け）

```bash
vercel --version
vercel link
vercel inspect
```

---

## 📝 正しい設定値

### Framework Settings
- **Framework Preset**: `Next.js`

### Build & Development Settings
- **Root Directory**: `./` または **空白（空欄）**
- **Build Command**: `next build`（自動検出）
- **Output Directory**: `.next`（自動検出）
- **Install Command**: `npm install`（自動検出）

### Git Settings
- **Production Branch**: `main`
- **Auto-deploy**: `Yes`

---

## ✅ 次のステップ

1. **VercelダッシュボードでSettings → Generalを開く**
2. **Framework Presetが`Next.js`になっているか確認** ✅
3. **Root Directoryが`./`または空白になっているか確認** ✅
4. **両方が正しく設定されていたら、Saveをクリック** ✅
5. **再デプロイを実行（Build Cacheを外す）** ✅
6. **ビルドログを確認** ✅

---

**まず、Settings → Generalで両方の設定（Framework PresetとRoot Directory）を確認してください！**

