# Vercel Root Directory 設定修正ガイド

## 🚨 エラー

```
Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.
```

---

## ✅ 原因

**VercelのRoot Directory設定が間違っている可能性が高い**

- `package.json`はリポジトリのルート（`/`）にある
- VercelのRoot Directory設定が別のディレクトリを指している
- その結果、Vercelが`package.json`を見つけられない

---

## 🔧 解決方法

### 1. VercelダッシュボードでRoot Directoryを確認・修正

**手順：**
1. **Vercelダッシュボード**を開く
2. **プロジェクトを選択**（`room8-system`）
3. **Settings** → **General** を開く
4. **Root Directory**セクションを確認

**確認ポイント：**
- **Root Directory**: `./` または **空白（空欄）** になっているか確認
- もし `app` や `src` など別の値が入っていたら、**削除して空白にする**（または`./`にする）

**修正方法：**
1. **Root Directory**のフィールドをクリック
2. **空白にする**（空欄にする）
3. または `./` を入力
4. **Save**をクリック

---

### 2. 再デプロイを実行

**設定を保存した後：**
1. **Deployments**タブを開く
2. 最新のデプロイメントの「...」メニューから**「Redeploy」**をクリック
3. または、新しいコミットをプッシュすると自動デプロイされます

---

## 📝 確認事項

### GitHubリポジトリの構造

**正しい構造（ルートに`package.json`がある）：**
```
room8-system/
├── package.json          ← ここにある
├── next.config.ts
├── app/
│   ├── page.tsx
│   └── layout.tsx
├── tsconfig.json
└── ...
```

### Vercel設定

**正しい設定：**
- **Root Directory**: `./` または **空白（空欄）**
- **Framework Preset**: `Next.js`
- **Git Branch**: `main`

---

## ✅ 確認チェックリスト

### Vercel設定を確認
- [ ] Root Directoryが`./`または空白になっている
- [ ] Framework Presetが`Next.js`になっている
- [ ] Git Branchが`main`になっている
- [ ] 設定を保存した

### 再デプロイ後
- [ ] ビルドログに`Installing dependencies...`が表示される
- [ ] ビルドログに`next`が検出される
- [ ] ビルドが成功する
- [ ] サイトが正常に表示される

---

## 🎯 手順まとめ

1. **Vercelダッシュボード**を開く
2. **Settings** → **General** を開く
3. **Root Directory**を確認・修正（空白または`./`にする）
4. **Save**をクリック
5. **再デプロイを実行**
6. **ビルドログを確認**（`package.json`が正しく検出されるか）
7. **サイトを確認**（正常に表示されるか）

---

**Root Directoryを`./`または空白に設定して、再デプロイしてください！**

