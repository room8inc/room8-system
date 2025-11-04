-- Fix admin user directly with known UUID
-- Phase 1 MVP: 既知のユーザーIDで直接管理者ユーザーを作成・更新

-- ユーザーID: bc5ea2e6-2b01-4baa-ab20-9feae092c67b
-- メールアドレス: k_tsuruta@room8.co.jp

-- ステップ1: ユーザーが存在しない場合は作成、存在する場合は更新
INSERT INTO public.users (
  id,
  email,
  name,
  member_type,
  is_individual,
  status,
  is_admin
)
VALUES (
  'bc5ea2e6-2b01-4baa-ab20-9feae092c67b',
  'k_tsuruta@room8.co.jp',
  '管理者',
  'dropin',
  true,
  'active',
  true
)
ON CONFLICT (id) DO UPDATE
SET 
  is_admin = true,
  email = EXCLUDED.email,
  status = 'active',
  updated_at = NOW();

-- ステップ2: 念のため、メールアドレスでも更新
UPDATE public.users
SET is_admin = true
WHERE email = 'k_tsuruta@room8.co.jp';

-- ステップ3: 確認用（このクエリは実行後に手動で確認してください）
-- SELECT id, email, is_admin, name, status FROM public.users WHERE id = 'bc5ea2e6-2b01-4baa-ab20-9feae092c67b';

