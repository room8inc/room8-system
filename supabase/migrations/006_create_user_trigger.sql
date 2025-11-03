-- Create trigger to automatically insert user data into public.users table
-- when a user is created in auth.users
-- Phase 1 MVP: 会員登録時に自動的にusersテーブルにINSERT

-- ============================================
-- 関数: ユーザー作成時にpublic.usersテーブルにINSERTする
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- auth.usersにユーザーが作成されたとき、public.usersテーブルにもINSERT
  -- 注意: この関数はservice_roleで実行されるため、RLSをバイパスします
  INSERT INTO public.users (
    id,
    email,
    name,
    name_kana,
    phone,
    address,
    member_type,
    is_individual,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'name_kana', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'address', NULL),
    COALESCE(NEW.raw_user_meta_data->>'member_type', 'regular'),
    COALESCE((NEW.raw_user_meta_data->>'is_individual')::boolean, true),
    'active'
  )
  ON CONFLICT (id) DO NOTHING; -- 既に存在する場合は何もしない
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- トリガー: auth.usersにINSERTされたときに実行
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 注意事項
-- ============================================
-- 1. このトリガーは、auth.usersにユーザーが作成されたときに自動的に実行されます
-- 2. クライアント側の会員登録フォームから、metadataに追加情報を送信する必要があります
-- 3. または、トリガー後にクライアント側でUPDATEする方法もあります
-- 
-- Phase 1では、signUp時にmetadataを送信する方法を採用します

