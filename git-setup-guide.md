# Room8 Git / GitHub セットアップガイド

## 🎯 はじめに

GitHubリポジトリを作成して、コードのバージョン管理を始めましょう。

**メリット：**
- ✅ コードのバージョン管理（変更履歴の追跡）
- ✅ Vercelと自動連携（自動デプロイ）
- ✅ バックアップ（クラウドに保存）
- ✅ 複数人で開発する場合も便利

---

## 📋 手順

### Step 1: GitHubリポジトリを作成

1. **GitHubにログイン**
   - https://github.com にアクセス
   - ログイン（アカウントがない場合は作成）

2. **新しいリポジトリを作成**
   - 右上の「+」をクリック
   - 「New repository」を選択

3. **リポジトリ情報を入力**
   - **Repository name**: `room8-system`（任意）
   - **Description**: `Room8 - コワーキングスペース管理システム`（任意）
   - **Visibility**: **Private**を選択（推奨）
     - 個人情報を含む可能性があるため、Privateが安全
   - **README.md**: チェックを**外す**（既に作成済みのため）
   - **.gitignore**: チェックを**外す**（後で手動で作成）
   - **License**: 選択しない（後で必要に応じて追加）

4. **リポジトリを作成**
   - 「Create repository」をクリック
   - リポジトリが作成されます

---

### Step 2: ローカルリポジトリを初期化

**現在のディレクトリ**: `/Users/tsuruta/Documents/0_RnD/Room8`

1. **Gitを初期化**
   ```bash
   cd /Users/tsuruta/Documents/0_RnD/Room8
   git init
   ```

2. **.gitignoreを作成**
   ```bash
   # 環境変数ファイル（APIキーなど）
   .env
   .env.local
   .env.development.local
   .env.test.local
   .env.production.local

   # 依存関係
   node_modules/
   .pnp
   .pnp.js

   # ビルド成果物
   .next/
   out/
   build/
   dist/

   # ログファイル
   *.log
   npm-debug.log*
   yarn-debug.log*
   yarn-error.log*

   # OS固有のファイル
   .DS_Store
   Thumbs.db

   # IDE設定
   .vscode/
   .idea/
   *.swp
   *.swo

   # 一時ファイル
   *.tmp
   .cache/
   ```

3. **最初のコミット**
   ```bash
   git add .
   git commit -m "Initial commit: Project setup"
   ```

---

### Step 3: GitHubリポジトリと連携

1. **GitHubリポジトリのURLを確認**
   - GitHubでリポジトリを開く
   - 「Code」ボタンをクリック
   - HTTPSのURLをコピー（例: `https://github.com/room8inc/room8-system.git`）

2. **リモートリポジトリを追加**
   ```bash
   git remote add origin https://github.com/room8inc/room8-system.git
   ```

3. **メインブランチを設定**
   ```bash
   git branch -M main
   ```

4. **プッシュ**
   ```bash
   git push -u origin main
   ```
   - GitHubの認証情報を入力
   - Personal Access Tokenが必要な場合あり

---

### Step 4: 今後の作業フロー

#### ファイルを変更したら

1. **変更内容を確認**
   ```bash
   git status
   ```

2. **変更をステージング**
   ```bash
   git add .
   # または特定のファイルだけ
   git add README.md
   ```

3. **コミット**
   ```bash
   git commit -m "コミットメッセージ（変更内容を簡潔に）"
   ```

4. **プッシュ**
   ```bash
   git push
   ```

#### 良いコミットメッセージの例

- ✅ `Add: 会員登録フォームを実装`
- ✅ `Fix: チェックイン時の時間外利用検知バグを修正`
- ✅ `Update: README.mdを更新`
- ✅ `Refactor: 認証ロジックを整理`

---

## 🔐 GitHub認証（Personal Access Token）

GitHubへのプッシュ時に認証が必要です。

### Personal Access Tokenを作成

1. **GitHubの設定を開く**
   - GitHubにログイン
   - 右上のプロフィール画像をクリック
   - 「Settings」を選択

2. **Developer settingsを開く**
   - 左メニュー下部の「Developer settings」をクリック
   - 「Personal access tokens」→「Tokens (classic)」を選択

3. **新しいトークンを作成**
   - 「Generate new token」→「Generate new token (classic)」をクリック
   - **Note**: `Room8 development`（任意の名前）
   - **Expiration**: 90 days（任意、無期限も可能）
   - **Scopes**: `repo`をチェック（リポジトリへのアクセス権限）

4. **トークンをコピー**
   - 「Generate token」をクリック
   - 表示されたトークンをコピー（**一度しか表示されないので注意**）

5. **トークンを使用**
   - プッシュ時にパスワードの代わりにトークンを入力
   - または、Gitの認証情報に保存

---

## 🤝 VercelとGitHubを連携（自動デプロイ）

### Vercelでプロジェクトを作成

1. **Vercelにログイン**
   - https://vercel.com にアクセス
   - GitHubアカウントでログイン

2. **新しいプロジェクトを作成**
   - 「Add New...」→「Project」をクリック
   - GitHubリポジトリから`room8inc/room8-system`を選択
   - 「Import」をクリック

3. **プロジェクト設定**
   - **Framework Preset**: Next.js（自動検出される場合あり）
   - **Root Directory**: `./`（そのまま）
   - **Environment Variables**: 後で設定（Supabase、StripeのAPIキーなど）

4. **デプロイ**
   - 「Deploy」をクリック
   - 初回デプロイが開始されます

### 自動デプロイの仕組み

- **GitHubにプッシュ** → **Vercelが自動検知** → **自動デプロイ**
- `main`ブランチへのプッシュで本番環境にデプロイ
- 他のブランチへのプッシュでプレビューデプロイが作成される

---

## 📝 .gitignoreの詳細

### 重要なポイント

**絶対にコミットしてはいけないもの：**

- `.env`ファイル（APIキー、シークレットキーなど）
- `node_modules/`（依存関係、再インストール可能）
- `.next/`（ビルド成果物、再ビルド可能）
- 個人情報を含むファイル

**コミットして良いもの：**

- ソースコード（`.ts`, `.tsx`, `.js`, `.jsx`など）
- 設定ファイル（`package.json`, `tsconfig.json`など）
- ドキュメント（`.md`ファイル）
- 公開可能な設定ファイル

---

## ✅ セットアップ完了後の確認

- [ ] GitHubリポジトリ作成完了
- [ ] ローカルリポジトリ初期化完了
- [ ] `.gitignore`作成完了
- [ ] 最初のコミット＆プッシュ完了
- [ ] VercelとGitHub連携完了（自動デプロイ設定）

---

## 💡 よくある質問

### Q: なぜPrivateリポジトリが推奨なの？

**A:** 個人情報（会員情報など）を含む可能性があるため、Publicリポジトリは非推奨です。Privateリポジトリでも無料で利用できます。

### Q: Personal Access Tokenはどこに保存するの？

**A:** 
- macOS: `キーチェーン`に保存（Gitが自動で処理）
- または、Git Credential Managerを使用

### Q: コミットはどのくらいの頻度でするの？

**A:** 
- 機能を1つ実装したら
- バグを修正したら
- ドキュメントを更新したら
- 最低限、作業の区切りごとにコミットすることを推奨

---

## 🎯 まとめ

### 次のステップ

1. ✅ **GitHubリポジトリ作成**
2. ✅ **ローカルリポジトリ初期化**
3. ✅ **最初のコミット＆プッシュ**
4. ⏳ **Vercelと連携**（自動デプロイ設定）
5. ⏳ **開発環境構築**（Node.js、Next.js）

### 重要ポイント

- ✅ **GitHubアカウントは無料**
- ✅ **Privateリポジトリも無料**
- ✅ **Vercelと自動連携可能**
- ✅ **コードのバージョン管理が可能**

---

**次のステップ**: GitHubリポジトリ作成後、開発環境構築に進みます。

