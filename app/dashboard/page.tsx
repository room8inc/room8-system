import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from './logout-button'
import { QRScannerButton } from './qr-scanner-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 現在のチェックイン状態を取得
  const { data: currentCheckin } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', user.id)
    .is('checkout_at', null)
    .single()

  // 今日のチェックイン履歴を取得
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  const { data: todayCheckins } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', user.id)
    .gte('checkin_at', todayStart)
    .order('checkin_at', { ascending: false })
    .limit(10)

  // 今日の総利用時間を計算（チェックアウト済みのみ）
  const todayDuration = todayCheckins
    ?.filter((c) => c.checkout_at && c.duration_minutes)
    .reduce((sum, c) => sum + (c.duration_minutes || 0), 0) || 0

  // ユーザー情報を取得
  const { data: userData } = await supabase
    .from('users')
    .select('member_type')
    .eq('id', user.id)
    .single()

  // 現在のプラン情報を取得
  const { data: currentPlan } = await supabase
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .single()

  const isCheckedIn = !!currentCheckin

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ダッシュボード
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              ようこそ、{user.email} さん
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* カード1: 現在の状態 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">現在の状態</h2>
            {isCheckedIn ? (
              <>
                <p className="mt-2 text-sm font-medium text-green-600">
                  チェックイン中
                </p>
                {currentCheckin.checkin_at && (
                  <p className="mt-1 text-xs text-gray-500">
                    チェックイン時刻: {new Date(currentCheckin.checkin_at).toLocaleString('ja-JP')}
                  </p>
                )}
                <QRScannerButton
                  mode="checkout"
                  buttonText="チェックアウト"
                  buttonClassName="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                />
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  現在チェックイン中ではありません
                </p>
                <QRScannerButton
                  mode="checkin"
                  buttonText="チェックイン"
                  buttonClassName="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                />
              </>
            )}
          </div>

          {/* カード2: 今日の利用状況 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">今日の利用状況</h2>
            {todayDuration > 0 ? (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  利用時間: {Math.floor(todayDuration / 60)}時間{todayDuration % 60}分
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  チェックイン回数: {todayCheckins?.length || 0}回
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                まだ利用していません
              </p>
            )}
          </div>

          {/* カード3: プラン情報 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">プラン情報</h2>
            {currentPlan ? (
              <>
                <p className="mt-2 text-sm text-gray-900">
                  {currentPlan.plans?.name || 'プラン名不明'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  会員種別: {userData?.member_type === 'regular' ? '定期会員' : userData?.member_type === 'dropin' ? 'ドロップイン' : 'ゲスト'}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                プラン未登録
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

