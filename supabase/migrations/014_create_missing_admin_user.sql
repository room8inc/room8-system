-- Create missing admin user in public.users table
-- Phase 1 MVP: k_tsuruta@room8.co.jpがpublic.usersに存在しない場合の対応

-- ============================================
-- 管理者ユーザーを手動で作成
-- ============================================
-- 注意: このマイグレーションは、auth.usersにユーザーが存在するが
-- public.usersに存在しない場合に使用します

-- ステップ1: auth.usersからユーザーIDを取得
DO $$
DECLARE
  admin_user_id UUID;
  admin_email TEXT := 'k_tsuruta@room8.co.jp';
BEGIN
  -- auth.usersからユーザーIDを取得
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  -- ユーザーが存在する場合、public.usersに作成
  IF admin_user_id IS NOT NULL THEN
    -- public.usersにユーザーが存在するか確認
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = admin_user_id) THEN
      -- public.usersにユーザーを作成
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
        admin_user_id,
        admin_email,
        '管理者',
        'dropin', -- デフォルト値
        true,
        'active',
        true -- 管理者として設定
      )
      ON CONFLICT (id) DO UPDATE
      SET is_admin = true; -- 既に存在する場合は管理者フラグを更新
      
      RAISE NOTICE 'Admin user created: % (id: %)', admin_email, admin_user_id;
    ELSE
      -- 既に存在する場合は管理者フラグを更新
      UPDATE public.users
      SET is_admin = true
      WHERE id = admin_user_id;
      
      RAISE NOTICE 'Admin user already exists, updated is_admin flag: % (id: %)', admin_email, admin_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'User not found in auth.users: %', admin_email;
  END IF;
END $$;

-- ステップ2: 念のため、メールアドレスでも更新（既存ユーザーの場合）
UPDATE public.users
SET is_admin = true
WHERE email = 'k_tsuruta@room8.co.jp';

