# Vercelプロジェクト再インポートガイド

## 🚨 状況

- `package.json`はGitHubに正しく存在している ✅
- `next`も`dependencies`に含まれている ✅
- しかし、Vercelが`package.json`を見つけられない ❌

**結論**: Vercelのプロジェクト設定が正しく認識されていない可能性があります。

---

## ✅ 解決方法：プロジェクトを再インポート

### ⚠️ 注意事項

- 再インポートしても、**環境変数は保持されます**
- **デプロイメント履歴は保持されます**（通常）
- ただし、念のため**環境変数をメモしておくことを推奨**

---

## 📝 手順（詳細）

### ステップ1: 環境変数をメモ（念のため）

1. **Vercelダッシュボード**を開く
2. **Settings** → **Environment Variables** を開く
3. 以下の環境変数をメモ：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - （その他設定している環境変数）

### ステップ2: プロジェクトを削除

1. **Settings** → **General** を開く
2. 一番下までスクロール
3. **「Delete Project」**セクションを見つける
4. **「Delete」**ボタンをクリック
5. 確認ダイアログが表示される
6. プロジェクト名を入力して確認
7. **「Delete」**をクリック

⚠️ **注意**: この操作は元に戻せません。ただし、GitHubリポジトリには影響しません。

### ステップ3: 新しいプロジェクトとして再インポート

1. **Vercelダッシュボード**のトップページに戻る
2. **「Add New...」** → **「Project」**をクリック
3. **GitHubリポジトリを選択**
   - `room8inc/room8-system`を選択
   - **「Import」**をクリック

### ステップ4: プロジェクト設定

**以下を必ず確認・設定してください：**

#### Framework Settings
- **Framework Preset**: `Next.js` を選択 ✅

#### Build & Development Settings
- **Root Directory**: **空白（空欄）のまま** ✅
- デフォルトのままでOK

#### Git Settings
- **Production Branch**: `main` ✅
- デフォルトのままでOK

#### Environment Variables（環境変数）
- **ステップ1でメモした環境変数を追加**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- （その他必要な環境変数）

### ステップ5: デプロイ

1. **設定を確認**
2. **「Deploy」**をクリック
3. デプロイが開始されます
4. ビルドログを確認

---

## 🔍 再インポート後の確認

### ビルドログで確認すべきこと

1. **「Cloning github.com/room8inc/room8-system」**
   - 最新のコミットがクローンされる

2. **「Installing dependencies...」**
   - `package.json`が検出される
   - `next`がインストールされる
   - **エラーが出ない**

3. **「Running "next build"...」**
   - Next.jsが正しく検出される
   - ビルドが実行される

4. **「Build completed successfully」**
   - ビルドが成功する

### サイトで確認すべきこと

1. **デプロイが完了したら「Visit」ボタンをクリック**
2. **「Room8 - コワーキングスペース管理システム」と表示される**
3. **「開発中...」と表示される**
4. **404エラーが出ない**

---

## ✅ 確認チェックリスト

### 再インポート前
- [ ] 環境変数をメモした
- [ ] Settings → Generalでプロジェクト名を確認した

### 再インポート時
- [ ] GitHubリポジトリを正しく選択した（`room8inc/room8-system`）
- [ ] Framework Preset: `Next.js`を選択した ✅
- [ ] Root Directory: 空白のままにした ✅
- [ ] 環境変数を再設定した ✅

### 再インポート後
- [ ] ビルドログで`package.json`が検出される
- [ ] ビルドログで`next`がインストールされる
- [ ] ビルドが成功する
- [ ] サイトが正常に表示される
- [ ] 404エラーが出ない

---

## 💡 補足

### なぜ再インポートが必要か？

- Vercelのプロジェクト設定が何らかの理由で正しく保存されていない
- Root DirectoryやFramework Presetの設定が内部的に矛盾している
- 再インポートすることで、設定がクリーンにリセットされる

### 再インポートしても安全？

- ✅ **GitHubリポジトリには影響しない**
- ✅ **環境変数は再設定すれば問題なし**
- ✅ **デプロイメント履歴は通常保持される**
- ⚠️ **環境変数は手動で再設定が必要**（メモしておけば問題なし）

---

## 🎯 次のステップ

1. **環境変数をメモ**
2. **プロジェクトを削除**
3. **新しいプロジェクトとして再インポート**
4. **設定を確認（Framework Preset: Next.js、Root Directory: 空白）**
5. **環境変数を再設定**
6. **デプロイ**
7. **ビルドログとサイトを確認**

---

**プロジェクトを再インポートすることで、設定がクリーンにリセットされ、問題が解決するはずです！**

