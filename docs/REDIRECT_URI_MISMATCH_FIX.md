# redirect_uri_mismatch エラーの解決方法

## エラーの原因

`redirect_uri_mismatch`エラーは、Google Cloud Consoleで設定した「承認済みのリダイレクトURI」と、実際にOAuth認証で送信されているリダイレクトURIが一致していない場合に発生します。

## 解決手順

### 1. 実際に送信されているリダイレクトURIを確認

1. ブラウザの開発者ツールを開く（F12キー）
2. 「Console」タブを開く
3. 「Googleアカウントで接続」ボタンをクリック
4. コンソールに表示される「リダイレクトURI」を確認

例:
```
リダイレクトURI: https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
```

### 2. Google Cloud Consoleで設定を確認

1. Google Cloud Console > **APIとサービス** > **認証情報**
2. 作成したOAuth 2.0クライアントIDをクリック
3. **承認済みのリダイレクトURI**セクションを確認

### 3. URIが一致しているか確認

**重要**: 以下が完全に一致している必要があります:
- プロトコル（`http` vs `https`）
- ドメイン名
- パス
- 末尾のスラッシュ（`/`）の有無

**例（一致している場合）**:
```
Google Cloud Console: https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
実際のURI: https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
✅ 一致
```

**例（一致していない場合）**:
```
Google Cloud Console: https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback/
実際のURI: https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
❌ 不一致（末尾のスラッシュ）
```

### 4. URIを修正

#### 方法1: Google Cloud ConsoleでURIを修正（推奨）

1. Google Cloud Console > **APIとサービス** > **認証情報**
2. 作成したOAuth 2.0クライアントIDをクリック
3. **承認済みのリダイレクトURI**セクションで、間違っているURIを削除
4. 正しいURIを追加（コンソールに表示されたURIをコピー）
5. **保存**をクリック

#### 方法2: 環境変数で明示的に指定

Vercel Dashboard > Settings > Environment Variables で以下を設定:

```
GOOGLE_OAUTH_REDIRECT_URI=https://room8-system.vercel.app/api/admin/google-calendar/oauth/callback
```

**注意**: 環境変数を設定した場合は、再デプロイが必要です。

## よくある間違い

1. **末尾のスラッシュ**: `/api/admin/google-calendar/oauth/callback/` ← これが間違い
2. **http vs https**: `http://` と `https://` は区別されます
3. **ドメイン名の不一致**: `room8-system.vercel.app` と `room8-system-vercel.app` は別物
4. **パスの不一致**: `/api/admin/google-calendar/oauth/callback` と `/api/admin/google-calendar/oauth/callback/` は別物

## 確認方法

1. ブラウザのコンソールで「リダイレクトURI」を確認
2. Google Cloud Consoleで設定したURIと比較
3. **完全一致**していることを確認

