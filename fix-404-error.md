# 404エラーの修正ガイド

## 🔍 問題

Vercelでデプロイは成功しているが、サイトを開くと404エラーが表示される。

```
404: NOT_FOUND
Code: NOT_FOUND
```

---

## ✅ 確認事項

### 1. Vercelのプロジェクト設定を確認

**確認方法：**
1. Vercelダッシュボードでプロジェクト（`room8-system`）を開く
2. **Settings** → **General** を開く
3. 以下の設定を確認：

**確認ポイント：**
- **Framework Preset**: `Next.js` になっているか
- **Root Directory**: `./` または空白（変更していない場合）
- **Build and Output Settings**: 
  - **Build Command**: `npm run build` または空白（自動検出）
  - **Output Directory**: `.next` または空白（自動検出）
  - **Install Command**: `npm install` または空白（自動検出）

**修正が必要な場合：**
- **Root Directory**: `./` に設定（または空白）
- **Framework Preset**: `Next.js` に設定
- その他は空白にして自動検出に任せる

---

### 2. ビルドログを確認

**確認方法：**
1. Vercelダッシュボードでプロジェクトを開く
2. **Deployments**タブを開く
3. 最新のデプロイメントをクリック
4. **Build Logs**タブを開く
5. ログを確認

**確認ポイント：**
- ✅ `Build completed successfully`
- ✅ `Route (app)` に `/` が含まれている
- ❌ エラーメッセージがないか

**エラーが出ている場合：**
- エラーメッセージを確認
- 必要に応じて修正して再デプロイ

---

### 3. デプロイされたファイルを確認

**確認方法：**
1. デプロイメント詳細画面を開く
2. **Functions**タブを開く
3. 関数が正しく生成されているか確認

**確認ポイント：**
- `/` のルートパスが存在するか
- `app/page.tsx` が正しくビルドされているか

---

## 🔧 修正方法

### 方法1: Vercelの設定を確認・修正

1. **Settings** → **General** を開く
2. **Root Directory**: `./` に設定（変更していない場合）
3. **Framework Preset**: `Next.js` を選択
4. その他の設定は空白にして自動検出に任せる
5. **Save**をクリック
6. 再デプロイを実行

### 方法2: 手動で再デプロイ

1. **Deployments**タブを開く
2. 最新のデプロイメントの「...」メニューから「Redeploy」をクリック
3. 再デプロイを実行

### 方法3: 新しいコミットをプッシュ

1. 小さな変更をコミット（例: README更新）
2. GitHubにプッシュ
3. Vercelが自動検知して再デプロイ

---

## 🎯 確認すべきポイント

### Vercelの設定

- [ ] **Root Directory**: `./` または空白
- [ ] **Framework Preset**: `Next.js`
- [ ] **Build Command**: 空白（自動検出）または `npm run build`
- [ ] **Output Directory**: 空白（自動検出）または `.next`

### ファイル構造

- [ ] `app/page.tsx` が存在する
- [ ] `app/layout.tsx` が存在する
- [ ] `package.json` が存在する
- [ ] `next.config.ts` が存在する

### ビルドログ

- [ ] ビルドが成功している
- [ ] エラーメッセージがない
- [ ] `/` のルートパスが生成されている

---

## 💡 よくある原因

### 1. Root Directoryが間違っている

**原因：**
- Root Directoryが`./`以外に設定されている
- 例: `app`や`src`などに設定されている

**修正方法：**
- Root Directoryを`./`に設定
- または空白にして自動検出に任せる

### 2. Framework Presetが間違っている

**原因：**
- Framework Presetが`Next.js`以外に設定されている
- 例: `Other`や`React`などに設定されている

**修正方法：**
- Framework Presetを`Next.js`に設定

### 3. ビルドコマンドが間違っている

**原因：**
- Build Commandが間違っている
- 例: `npm install && npm run build`など、余計なコマンドが含まれている

**修正方法：**
- Build Commandを空白にする（自動検出に任せる）
- または `npm run build` に設定

### 4. キャッシュの問題

**原因：**
- Vercelのキャッシュが古い
- ビルドキャッシュが壊れている

**修正方法：**
- 再デプロイを実行
- または、Settings → General → **Clear Build Cache** を実行

---

## ✅ 修正後の確認

### 1. 再デプロイを実行

1. Vercelダッシュボードで再デプロイ
2. または、新しいコミットをプッシュ

### 2. デプロイ完了を待つ

1. デプロイメントの状態が「Ready」になるまで待つ
2. 数分かかる場合があります

### 3. サイトを確認

1. デプロイメントの「Visit」ボタンをクリック
2. または、プロジェクトのURLを開く
3. サイトが正常に表示されるか確認

---

## 📝 まとめ

### 確認すべきポイント

1. **Vercelの設定**（Root Directory、Framework Preset）
2. **ビルドログ**（エラーがないか）
3. **ファイル構造**（`app/page.tsx`が存在するか）

### 修正方法

1. Vercelの設定を確認・修正
2. 再デプロイを実行
3. ビルドログを確認

---

**修正後、サイトが正常に表示されるか確認してください。**

