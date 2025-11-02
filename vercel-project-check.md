# Vercelプロジェクト設定確認ガイド

## 🔍 問題

Vercelでデプロイは成功しているが、実際にはソースコードがデプロイされていない（mdファイルと.gitignoreしかない）。

---

## ✅ 確認事項

### 1. GitHubリポジトリの内容を確認

**GitHubのWeb UIで確認：**
1. https://github.com/room8inc/room8-system にアクセス
2. リポジトリの内容を確認
3. 以下のファイルが存在するか確認：
   - [ ] `package.json`
   - [ ] `next.config.ts`
   - [ ] `app/page.tsx`
   - [ ] `app/layout.tsx`
   - [ ] `tsconfig.json`
   - [ ] `vercel.json`

**ファイルが表示されていない場合：**
- 再度プッシュを実行
- または、GitHubリポジトリのブランチを確認（mainブランチにいるか）

---

### 2. Vercelのプロジェクト設定を確認

**Vercelダッシュボードで確認：**

1. **Settings** → **General** を開く
2. 以下の設定を確認：

**確認ポイント：**
- **Root Directory**: `./` または空白（変更していない場合）
- **Framework Preset**: `Next.js`
- **Git Branch**: `main` または `master`
- **Auto-deploy**: `Yes`（GitHubにプッシュすると自動デプロイ）

**修正が必要な場合：**
- **Root Directory**: `./` に設定
- **Git Branch**: `main` を選択
- **Framework Preset**: `Next.js` を選択
- **Save**をクリック

---

### 3. Vercelのデプロイメント設定を確認

**Vercelダッシュボードで確認：**

1. **Deployments**タブを開く
2. 最新のデプロイメントをクリック
3. **Build Logs**タブを開く
4. 以下のログを確認：

**確認ポイント：**
- `Installing dependencies...`
- `Running "npm run build"...`
- `Build completed successfully`
- `Route (app)` に `/` が含まれている

**ログに問題がある場合：**
- エラーメッセージを確認
- `package.json`が正しく読み込まれているか確認

---

### 4. Source（ソース）の確認

**Vercelダッシュボードで確認：**

1. **Settings** → **General** を開く
2. **Source**セクションを確認

**確認ポイント：**
- **Repository**: `room8inc/room8-system`
- **Branch**: `main`
- **Root Directory**: `./` または空白

---

## 🔧 修正方法

### 方法1: Vercelの設定を確認・修正

1. **Settings** → **General** を開く
2. **Root Directory**: `./` に設定（変更していない場合）
3. **Git Branch**: `main` を選択
4. **Framework Preset**: `Next.js` を選択
5. **Save**をクリック
6. **再デプロイを実行**

### 方法2: プロジェクトを再インポート

1. **Settings** → **General** を開く
2. **Delete Project**をクリック（⚠️ 慎重に）
3. 新しいプロジェクトとして再インポート
4. GitHubリポジトリから`room8inc/room8-system`を選択
5. **Import**をクリック
6. 設定を確認して**Deploy**をクリック

---

## 💡 よくある原因

### 1. Root Directoryが間違っている

**原因：**
- Root Directoryが`./`以外に設定されている
- 例: `app`や`src`などに設定されている

**確認方法：**
- Vercelダッシュボードで確認
- Settings → General → Root Directory

**修正方法：**
- Root Directoryを`./`に設定
- または空白にして自動検出に任せる

### 2. 別のブランチをデプロイしている

**原因：**
- Git Branchが`main`以外に設定されている
- 例: `master`や`develop`など

**確認方法：**
- Vercelダッシュボードで確認
- Settings → General → Git Branch

**修正方法：**
- Git Branchを`main`に設定

### 3. GitHubリポジトリにファイルがプッシュされていない

**原因：**
- ローカルにはあるが、GitHubにプッシュされていない

**確認方法：**
- GitHubのWeb UIで確認
- https://github.com/room8inc/room8-system

**修正方法：**
- 再度プッシュを実行
- `git push origin main`

---

## ✅ 確認チェックリスト

### GitHubリポジトリ
- [ ] GitHubのWeb UIでリポジトリを確認
- [ ] `package.json`が存在する
- [ ] `app/page.tsx`が存在する
- [ ] `next.config.ts`が存在する

### Vercel設定
- [ ] Root Directoryが`./`または空白
- [ ] Git Branchが`main`
- [ ] Framework Presetが`Next.js`
- [ ] Repositoryが`room8inc/room8-system`

### デプロイメント
- [ ] ビルドログにエラーがない
- [ ] `package.json`が正しく読み込まれている
- [ ] `npm run build`が実行されている
- [ ] ビルドが成功している

---

## 🎯 次のステップ

1. **GitHubリポジトリの内容を確認**（Web UI）
2. **Vercelの設定を確認**（Root Directory、Git Branch）
3. **必要に応じて修正**
4. **再デプロイを実行**

---

**まずは、GitHubリポジトリのWeb UIで、ソースコードファイルが正しく表示されているか確認してください！**

