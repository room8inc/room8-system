import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import { StripeModeToggle } from './stripe-mode-toggle'
import { UserTable } from './user-table'

export default async function AdminPage() {
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

  // ユーザー一覧を取得
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, member_type, is_admin, has_shared_office, stripe_customer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ダッシュボードに戻る
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-room-charcoal">
                管理者画面 - ユーザー管理
              </h1>
              <p className="mt-2 text-sm text-room-charcoal-light">
                会員ステータス・シェアオフィスオプションの管理
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StripeModeToggle />
              <Link
                href="/admin/lockers"
                className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
              >
                ロッカー管理
              </Link>
              <Link
                href="/admin/campaigns"
                className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
              >
                キャンペーン管理
              </Link>
              <Link
                href="/admin/knowledge"
                className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
              >
                ナレッジ管理
              </Link>
              <Link
                href="/admin/google-calendar"
                className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
              >
                Googleカレンダー連携
              </Link>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {usersError && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              ユーザー情報の取得に失敗しました: {usersError.message}
            </p>
          </div>
        )}

        {/* ユーザー一覧 */}
        <UserTable
          users={(users || []).map((u) => ({
            ...u,
            has_shared_office: u.has_shared_office ?? false,
          }))}
        />
      </div>
    </div>
  )
}
