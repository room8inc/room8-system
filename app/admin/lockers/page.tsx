import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import LockerManagement from './locker-management'

export default async function AdminLockersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await isAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  // ロッカー一覧を取得（user_idがある場合はusers.nameもjoin）
  const { data: lockers, error } = await supabase
    .from('lockers')
    .select('id, locker_number, size, status, user_id, notes, users:user_id(name)')
    .order('locker_number', { ascending: true })

  const lockersWithUserName = (lockers || []).map((locker: any) => ({
    id: locker.id,
    locker_number: locker.locker_number,
    size: locker.size,
    status: locker.status,
    user_id: locker.user_id,
    notes: locker.notes,
    user_name: locker.users?.name || null,
  }))

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← 管理者画面に戻る
          </Link>
          <div className="mt-2">
            <h1 className="text-3xl font-bold text-room-charcoal">
              ロッカー管理
            </h1>
            <p className="mt-2 text-sm text-room-charcoal-light">
              ロッカーの状態確認・ステータス変更・追加削除ができます
            </p>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              ロッカー情報の取得に失敗しました: {error.message}
            </p>
          </div>
        )}

        <LockerManagement lockers={lockersWithUserName} />
      </div>
    </div>
  )
}
