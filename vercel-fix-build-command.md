# Vercel Build Command 明示的設定ガイド

## ✅ 確認済み

- GitHubリポジトリに`package.json`が正しく存在 ✅
- `package.json`に`next`が含まれている ✅
- ローカルでビルドが成功 ✅

**問題はVercel側の設定です。**

---

## 🔧 解決方法1: Build Commandを明示的に設定

### 手順

1. **Vercelダッシュボード**を開く
2. **プロジェクトを選択**（`room8-system`）
3. **Settings** → **General** を開く
4. **Build & Development Settings**セクションを開く
5. 以下の設定を確認・変更：

#### Build Command
- **Build Command**: `npm run build`（明示的に設定）
- もし空白なら、`npm run build`を入力

#### Install Command
- **Install Command**: `npm install`（明示的に設定）
- もし空白なら、`npm install`を入力

#### Root Directory
- **Root Directory**: **空白（空欄）のまま** ✅
- もし何か値が入っていたら削除

6. **Save**をクリック

---

## 🔧 解決方法2: vercel.jsonで明示的に設定

既に`vercel.json`がありますが、より明示的に設定します。

### 現在のvercel.json

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

これは正しいですが、Vercelが`package.json`を見つけられない場合、`vercel.json`自体が検出されていない可能性があります。

---

## 🔍 確認事項

### 1. Vercelのビルドログで確認

**Vercelダッシュボード** → **Deployments** → 最新のデプロイメント → **Build Logs**

以下のログを確認：

```
Cloning github.com/room8inc/room8-system (Branch: main, Commit: XXXXXX)
```

**確認ポイント：**
- `Commit: XXXXXX`が最新のコミット（`0f674ff`）になっているか？
- もし古いコミットなら、Vercelが最新コミットをクローンしていない

### 2. ビルドログのエラー前後のログ

エラーが出る直前のログを確認：

```
Installing dependencies...
```

この前後で、`package.json`が検出されているかどうかが重要です。

---

## 💡 試すべきこと（順番に）

### ステップ1: Build Commandを明示的に設定

1. Settings → General → Build & Development Settings
2. **Build Command**: `npm run build`を設定
3. **Install Command**: `npm install`を設定
4. **Save**をクリック
5. **再デプロイを実行**

### ステップ2: それでもダメなら、ビルドログを確認

ビルドログで以下を確認：
- どのコミットをクローンしているか
- `package.json`が検出されているか
- エラーが出る直前のログ

### ステップ3: まだダメなら、プロジェクトを再インポート

詳細は`vercel-project-reimport.md`を参照してください。

---

## 🎯 次のアクション

**まず、以下を実行してください：**

1. **Settings → General → Build & Development Settings**を開く
2. **Build Command**: `npm run build`を設定
3. **Install Command**: `npm install`を設定
4. **Root Directory**: 空白（空欄）を確認
5. **Save**をクリック
6. **再デプロイを実行（Build Cacheを外す）**
7. **ビルドログを確認**

もしそれでもエラーが出る場合：
- ビルドログの完全な内容（特にエラー前後）を共有してください
- どのコミットをクローンしているか（`Commit: XXXXXX`）を教えてください

---

**Build Commandを明示的に設定してみてください！**

