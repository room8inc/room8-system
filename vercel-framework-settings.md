# Vercel Framework Settings 確認ガイド

## 🎯 Framework Presetの設定

**Framework Preset**: `Next.js` を選択した場合の確認事項

---

## ✅ 設定後の確認

### 1. 設定を保存

1. **Framework Preset**: `Next.js` を選択
2. 「Configuration Settings in the current Production deployment differ from your current Project Settings. Production Overrides」というメッセージが表示される
3. **OK**をクリック（または**Save**をクリック）
4. 設定が保存されます

---

### 2. Production Overrideについて

**メッセージの意味：**
- 現在のプロジェクト設定と、実際のデプロイメントの設定が異なる
- 次回のデプロイ時に新しい設定が適用される

**対応方法：**
- ✅ **OK**をクリック（推奨）
- 新しい設定が次回のデプロイ時に適用されます
- または、Production Overrideを確認して、必要に応じて調整

---

### 3. 再デプロイを実行

**設定を保存した後：**

1. **Deployments**タブを開く
2. 最新のデプロイメントの「...」メニューから「Redeploy」をクリック
3. または、新しいコミットをプッシュすると自動デプロイされます

---

## 🔍 確認項目

### Framework Preset設定後

- [ ] Framework Presetが`Next.js`に設定されている
- [ ] 「OK」をクリックして設定を保存
- [ ] 再デプロイを実行（または自動デプロイを待つ）
- [ ] ビルドログで`Next.js`が正しく検出されているか確認

### 再デプロイ後の確認

- [ ] ビルドログにエラーがない
- [ ] `Next.js`が正しく検出されている
- [ ] サイトが正常に表示される
- [ ] 404エラーが解消されている

---

## ✅ 次のステップ

1. **設定を保存**（「OK」をクリック）
2. **再デプロイを実行**（または新しいコミットをプッシュ）
3. **デプロイ完了を待つ**（数分）
4. **サイトを確認**（404エラーが解消されているか）

---

**設定を保存した後、再デプロイを実行してください！**

