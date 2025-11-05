# Googleカレンダー連携 - OAuth認証設定ガイド

## OAuth認証設定手順

### 1. Google Cloud Consoleでプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成（または既存のプロジェクトを選択）

### 2. Google Calendar APIを有効化

1. Google Cloud Console > **APIとサービス** > **ライブラリ**
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

### 3. OAuth 2.0クライアントIDを作成

1. Google Cloud Console > **APIとサービス** > **認証情報**
2. **+ 認証情報を作成** > **OAuth クライアント ID**
3. **アプリケーションの種類**: **ウェブアプリケーション** を選択
4. **名前**: 任意の名前（例：「Room8 Calendar Integration」）

#### 重要な設定項目

##### 承認済みの JavaScript 生成元

**用途**: ブラウザからのリクエストに使用します（今回はサーバーサイドなので設定不要）

**設定**: 空欄のままでもOK（サーバーサイド認証の場合）

##### 承認済みのリダイレクト URI

**用途**: OAuth認証後のコールバックURL（必須）

**設定方法**:

1. **まず、実際のドメインを確認する方法**:

   **方法1: Vercel Dashboardで確認**
   - Vercel Dashboard > プロジェクトを選択 > Settings > Domains
   - 表示されているドメインを確認（例: `your-project.vercel.app` またはカスタムドメイン）

   **方法2: デプロイ後のURLを確認**
   - Vercel Dashboard > Deployments > 最新のデプロイを開く
   - 「Visit」ボタンのURLを確認（例: `https://your-project.vercel.app`）

   **方法3: 環境変数で確認**
   - Vercel Dashboard > Settings > Environment Variables
   - `VERCEL_URL` または `NEXT_PUBLIC_SITE_URL` が設定されている場合は、その値を確認

2. **URI を追加** ボタンをクリックして、以下のURIを追加:

   ```
   https://【確認したドメイン】/api/admin/google-calendar/oauth/callback
   ```

   **例**:
   - ドメインが `room8-system.vercel.app` の場合:
     ```
     https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
     ```
   - カスタムドメインが `room8.example.com` の場合:
     ```
     https://room8.example.com/api/admin/google-calendar/oauth/callback
     ```

3. **作成** をクリック

### 4. クライアントIDとシークレットを取得

1. 作成したOAuth 2.0クライアントIDをクリック
2. **クライアントID** をコピー → `GOOGLE_OAUTH_CLIENT_ID` に設定
3. **クライアントシークレット** をコピー → `GOOGLE_OAUTH_CLIENT_SECRET` に設定

**重要**: クライアントシークレットは一度しか表示されません。必ずコピーして保存してください。

### 5. 環境変数を設定

Vercel Dashboard > Settings > Environment Variables で以下を設定:

```
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
```

**重要**: リダイレクトURIを明示的に設定することを推奨します:

```
GOOGLE_OAUTH_REDIRECT_URI=https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
```

または、本番環境のURLを設定:

```
NEXT_PUBLIC_SITE_URL=https://room8-system.vercel.app
```

**注意**: `VERCEL_URL`環境変数は使用しないでください。プレビュー環境のURLになる可能性があります。

### 6. 管理画面で接続

1. `/admin/google-calendar` にアクセス
2. **「Googleアカウントで接続」** ボタンをクリック
3. Googleアカウントでログイン
4. アクセス許可を承認

## よくある質問

### Q: 承認済みのJavaScript生成元は設定する必要がありますか？

**A**: サーバーサイド認証の場合、**設定不要**です。空欄のままでもOKです。

### Q: リダイレクトURIは複数設定できますか？

**A**: はい、複数のドメインを設定できます。例:
- `https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback`
- `https://room8.example.com/api/admin/google-calendar/oauth/callback`（カスタムドメインの場合）

### Q: リダイレクトURIが一致しないエラーが出ます

**A**: リダイレクトURIが完全に一致している必要があります。
- 末尾のスラッシュ（`/`）も含めて完全一致
- `http` と `https` も区別されます
- パスも完全一致が必要です

### Q: 本番環境のドメインがわかりません

**A**: Vercelの場合:
1. Vercel Dashboard > Settings > Domains で確認
2. または、デプロイ後のURLを確認（例: `https://your-project.vercel.app`）

## トラブルシューティング

### エラー: redirect_uri_mismatch

**原因**: リダイレクトURIがGoogle Cloud Consoleで設定したものと一致していない

**解決方法**:
1. Google Cloud Consoleで設定したリダイレクトURIを確認
2. 環境変数 `GOOGLE_OAUTH_REDIRECT_URI` が設定されている場合は、それも確認
3. 完全一致するように修正

### エラー: GOOGLE_OAUTH_CLIENT_ID環境変数が設定されていません

**原因**: 環境変数が設定されていない、またはVercelにデプロイされていない

**解決方法**:
1. Vercel Dashboard > Settings > Environment Variables で確認
2. 環境変数が設定されている場合は、再デプロイが必要な場合があります
3. Vercel Dashboard > Deployments > 最新のデプロイを選択 > Redeploy

