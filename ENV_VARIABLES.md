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

### Google Calendar関連

**認証方法が2つあります。どちらか一方を選択してください：**

#### 方法1: OAuth認証（推奨・簡単）

管理者のGoogleアカウントでログインして接続する方法です。

| 環境変数名 | 用途 | 取得方法 |
|-----------|------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth 2.0クライアントID | Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > 作成 > Webアプリケーション<br>**クライアントIDをコピー** |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth 2.0クライアントシークレット | Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > 作成したクライアントID > 編集<br>**クライアントシークレットをコピー** |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth認証のリダイレクトURI（推奨） | 本番環境のURLを明示的に設定（例: `https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback`）<br>**設定しない場合は自動設定されるが、プレビュー環境のURLになる可能性があるため、明示的に設定することを推奨** |
| `NEXT_PUBLIC_SITE_URL` | 本番環境のURL（オプション） | 本番環境のドメインを設定（例: `https://room8-system.vercel.app`）<br>**GOOGLE_OAUTH_REDIRECT_URIが設定されていない場合に使用される** |

**設定手順:**
1. Google Cloud Consoleでプロジェクトを作成
2. Google Calendar APIを有効化
3. OAuth 2.0クライアントIDを作成（Webアプリケーション）
   - **承認済みのJavaScript生成元**: 空欄のまま（サーバーサイド認証のため不要）
   - **承認済みのリダイレクトURI**: `https://your-domain.com/api/admin/google-calendar/oauth/callback`
     - （`your-domain.com`を実際のVercelドメインに置き換える。例: `https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback`）
4. クライアントIDとシークレットをコピーして環境変数に設定
5. 管理画面（`/admin/google-calendar`）で「Googleアカウントで接続」ボタンをクリック

**詳細な設定手順は** `docs/GOOGLE_OAUTH_SETUP.md` を参照してください。

#### 方法2: Service Account（従来の方法）

Service Accountのキーを使用する方法です。

| 環境変数名 | 用途 | 取得方法 |
|-----------|------|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Service Accountのメールアドレス | Google Cloud Console > IAM & Admin > Service Accounts > 作成したService Accountのメールアドレス<br>**またはJSONファイルの`client_email`フィールド** |
| `GOOGLE_PRIVATE_KEY` | Google Service Accountの秘密鍵（JSON形式の`private_key`フィールド） | Google Cloud Console > IAM & Admin > Service Accounts > 作成したService Account > Keys > JSONキーをダウンロードして`private_key`フィールドの値を取得<br>**JSONファイルの`private_key`フィールドをそのまま使用（改行文字`\n`を含む）**<br>**または、Base64エンコードされたJSON全体を`GOOGLE_PRIVATE_KEY_BASE64`に設定** |
| `GOOGLE_PRIVATE_KEY_BASE64` | Google Service AccountのJSONファイル全体をBase64エンコードした値（オプション） | JSONファイル全体をBase64エンコード（`base64 -i service-account.json`）<br>**`error:1E08010C:DECODER routines::unsupported`エラーが出る場合は、この方法を使用** |
| `GOOGLE_CALENDAR_ID` | GoogleカレンダーのID（予約管理用・オプション） | Google Calendar > 設定 > 共有したいカレンダーの「カレンダーID」を確認（通常は`primary`またはメールアドレス形式）<br>**※ 管理画面でカレンダーを選択できるため、環境変数での設定は不要（後方互換性のために残す）** |

**設定手順:**
1. Google Cloud Consoleでプロジェクトを作成
2. Google Calendar APIを有効化
3. Service Accountを作成し、JSONキーをダウンロード
4. **方法1（通常）**: JSONファイルの`client_email`フィールドの値を`GOOGLE_SERVICE_ACCOUNT_EMAIL`に設定
5. **方法2（通常）**: JSONファイルの`private_key`フィールドの値を`GOOGLE_PRIVATE_KEY`に設定（改行文字`\n`はそのまま保持、ダブルクォートで囲む）
6. **方法3（エラーが出る場合）**: JSONファイル全体をBase64エンコードして`GOOGLE_PRIVATE_KEY_BASE64`に設定（`GOOGLE_PRIVATE_KEY`は設定不要）
7. Service Accountのメールアドレスをカレンダーに共有（編集権限を付与）
8. 管理画面（`/admin/google-calendar`）で使用するカレンダーを選択

## 🔒 セキュリティ注意事項

- **機密情報を含む環境変数**（`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY_TEST`, `GOOGLE_PRIVATE_KEY`）は：
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
- 2025-01-XX: Google Calendar連携追加
  - Google Calendar関連: 3つの環境変数
