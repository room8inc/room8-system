# auth.usersからメールアドレスでユーザーを削除する方法

## 問題
`public.users`から手動で削除したが、`auth.users`に残っているため、同じメールアドレスで再登録できない。

## 解決方法

### 方法1: Supabase Dashboardから削除（推奨）

1. **Supabase Dashboardにログイン**
   - https://supabase.com/dashboard にアクセス

2. **Authentication > Users を開く**
   - 左メニューから「Authentication」をクリック
   - 「Users」タブを選択

3. **メールアドレスで検索**
   - 上部の検索ボックスにメールアドレスを入力
   - 該当するユーザーを探す

4. **ユーザーを削除**
   - 該当ユーザーの行の右側にある「...」（三点リーダー）をクリック
   - 「Delete user」を選択
   - 確認ダイアログで「Delete」をクリック

### 方法2: SQL Editorで確認・削除（メールアドレスからユーザーIDを特定）

1. **Supabase Dashboard > SQL Editor を開く**

2. **メールアドレスからユーザーIDを検索**
   ```sql
   -- メールアドレスからユーザーIDを検索
   SELECT id, email, created_at
   FROM auth.users
   WHERE email = '削除したいメールアドレス@example.com';
   ```

3. **ユーザーIDが分かったら、Admin APIで削除**
   - ただし、SQL Editorから直接`auth.users`を削除することはできません
   - Admin APIを使用する必要があります

### 方法3: コードでメールアドレスから削除する機能を追加

Admin画面に「メールアドレスからユーザーを削除」機能を追加することもできます。

## 注意事項

- `auth.users`から削除すると、そのユーザーは完全に削除されます
- 削除後、同じメールアドレスで再登録可能になります
- `public.users`にもデータが残っている場合は、そちらも削除してください

