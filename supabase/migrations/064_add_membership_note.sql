-- 会員管理用カラム追加
-- membership_note: 銀行振込やその他手動管理が必要な会員への備考欄
-- has_shared_office: シェアオフィスオプション（住所利用・郵便物受取・会議室月4h無料等）

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS membership_note TEXT,
  ADD COLUMN IF NOT EXISTS has_shared_office BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.membership_note IS '会員管理メモ（例: 銀行振込 毎月15日、旧プラン据え置き等）';
COMMENT ON COLUMN users.has_shared_office IS 'シェアオフィスオプション契約の有無';
