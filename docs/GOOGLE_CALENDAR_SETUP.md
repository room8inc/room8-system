# Googleカレンダー連携 - 環境変数の設定方法

## JSONファイルから環境変数を設定する方法

Google Service AccountのJSONファイルをダウンロードしたら、以下のように環境変数を設定してください。

### 1. GOOGLE_SERVICE_ACCOUNT_EMAIL

**JSONファイルの`client_email`フィールドの値を使用**

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=calendar-access@room8-system.iam.gserviceaccount.com
```

### 2. GOOGLE_PRIVATE_KEY

**JSONファイルの`private_key`フィールドの値をそのまま使用**

```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDPrvx3civfFJu2\n..."
```

**重要**: 
- 値をダブルクォート（`"`）で囲む
- 改行文字（`\n`）はそのまま保持する
- 全体を1行で設定する

### 3. GOOGLE_CALENDAR_ID

**Googleカレンダーの設定から取得**

1. Googleカレンダーを開く
2. 設定（歯車アイコン）をクリック
3. 左メニューから「設定」を選択
4. カレンダーを統合する → カレンダーIDを確認

通常は以下のいずれかです：
- `primary`（メインカレンダーの場合）
- メールアドレス形式（例: `your-calendar@gmail.com`）

```
GOOGLE_CALENDAR_ID=primary
```

または

```
GOOGLE_CALENDAR_ID=your-calendar@gmail.com
```

## あなたのJSONファイルからの設定例

提供されたJSONファイルから、以下のように設定してください：

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=calendar-access@room8-system.iam.gserviceaccount.com

GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDPrvx3civfFJu2\n3cJQNk95JUMWwyBCgI0kSkOVT4MsWgZyAeD2KB3IJDQNFNNJOtNC+OL3gkK9qU9i\nN/sdp2WgZHsMZSXY/s3wP8SXRVVJwuvgk51Zv3VRoLFQzXGq1E/Ll+O47PwFz5RK\nsEJcTrJa5bG39eKqoJ+U8hejKgK57Z0txdJo/4zhZfUF5ec4ks4uwP+7EmOK6pUc\nyYBBfh41wB2wvJlWFGazRLBQM7UBLItGtZ7Q5GUA6DTqskxEAPN4VsHK7CPtIWBa\nScBuR4BE5RxzLqGdc27IS1cO/EO88ic26/cWSvXbMi9pNfn++WsvkAXJr44p4+1h\nb/ol/AjVAgMBAAECggEAFMiXtmJkFo6K6Ll3jSxqNp7ugFQlodIYjdWqvsH2yBT4\nSSd7+lZYaKOK2/ZGELGE29JpcEiGYlGTwqoEhNqwNmVn1P04VOdm95CCHXtQRjHu\nBgrvt8ALvw/8PrBYnDZkB+Va4jJBJFm6JuFNuswbWDJdXyIJvXaWkcLKb8cv/6gk\nCLI30v4MiRiASUqeZqbjVGbNjAYy75zXAx6IaZNNa59LERihiHwv9+Qv18dtFoa8\nCUiD3Of3WGcU57MPQAAvz0XX2Io7PfjgTb42Mdno1V2E1H3h9gdPHxZRyBBKpUCN\nfhmFZX198DAME0cktrBKi/Hglfw0s3XDcQ6MCoO/fwKBgQD4K5AB7OH3Iy3TtLry\nGkZriiCfc1auU9fsSYNiAWmOu8kTYlOvmN2Fqpm8nEywejMcXMfJ0HEPQrybQWVf\ncj/I+dfSYwNpr802Ljq+YU8zzL8qLDKRdELbjN+JTXU/UVVvKNH5TkdQQv/dLGDE\nb7tDDGNUCsMWpaaLJqCCD4L46wKBgQDWPGsnEnAUrHoo28xfTESyTHvrxcMgMXr4\nnGkrOYOrQGbsAFDiC4avOWoRx3yUOvHCwbQEmyBwGHANe1IUVpZflL0mT5GdF98m\nz4KRjd+VWnMbjfpY9iSlBA3+BnUXwnkcbF3P1rHz8mczfHfXg+xGdQLKdZGXDIum\nO5du1aCVPwKBgQDxv3XT+k6QsUs1/MtThfbtUSvAR9m7jd87xMzgTqHmMdWJNXJy\nDsZULEEAc31dOFzLlzHjzVIlXIxf7Q90L9Yk0ATGZD9x15he3B/LTv2ZZy0dRtqn\nyIpMVul2VecOHAvOcgRBCFj9vZaDfHRzRqgzg0DLIIS0bf9Tc/hNWhDqqwKBgQC6\nJI75yPRnkiEmRSxDFTKPNRNrHU7YNwXg444hh3yXHIMQxYmBjoA82YcG4ayl4r1S\n+hke82Zw31rk6+S6VS2c6NCcbABaXXZ/80dAjuPYkll3dJo0F9JpKqe5swSkW039\n2057mtDN5C21N42tTSvLYDnHjfWtJ7JjAl4maCl54wKBgQC090nUMqaY8DLRiz/K\nhyguMEdVwRN8q2GaDL+XuWkUPoTgZvAZPhXDrquokQXPV9ZeNrMtz9qYefMxUZ1J\nzwaiKUCwVWOcuJjYgM1v2N1RojKxz1ji307zyahO/TJ01h4IbSGRhgzm+6zAdxSV\nRPGf8RmXME0HLtBpvL/eRl+HLQ==\n-----END PRIVATE KEY-----\n"

GOOGLE_CALENDAR_ID=primary
```

**注意**: `GOOGLE_CALENDAR_ID`は実際のカレンダーIDに置き換えてください。

## 次のステップ

1. Service Accountのメールアドレス（`calendar-access@room8-system.iam.gserviceaccount.com`）をGoogleカレンダーに共有
   - カレンダー設定 → 共有設定 → ユーザーを追加
   - メールアドレスを入力し、「編集」権限を付与

2. カレンダーIDを確認
   - カレンダー設定 → カレンダーを統合する → カレンダーIDをコピー

3. Vercelに環境変数を設定
   - Vercel Dashboard → Settings → Environment Variables
   - 上記の3つの環境変数を追加

4. 接続テスト
   - `/admin/google-calendar`ページで「接続テスト」ボタンをクリック

