import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import { GoogleCalendarSettings } from './google-calendar-settings'

export default async function GoogleCalendarPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 管理者権限チェック
  const admin = await isAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

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
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            Googleカレンダー連携設定
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            Googleカレンダーとの連携状況を確認・管理できます
          </p>
        </div>

        {/* Googleカレンダー設定 */}
        <GoogleCalendarSettings />
      </div>
    </div>
  )
}
