import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            ダッシュボード
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            ようこそ、{user.email} さん
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* カード1: 現在の状態 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">現在の状態</h2>
            <p className="mt-2 text-sm text-gray-600">
              現在チェックイン中ではありません
            </p>
            <button className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              チェックイン
            </button>
          </div>

          {/* カード2: 今日の利用状況 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">今日の利用状況</h2>
            <p className="mt-2 text-sm text-gray-600">
              まだ利用していません
            </p>
          </div>

          {/* カード3: プラン情報 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">プラン情報</h2>
            <p className="mt-2 text-sm text-gray-600">
              プラン未登録
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

