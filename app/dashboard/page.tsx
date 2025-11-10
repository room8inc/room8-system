import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { LogoutButton } from './logout-button'
import { QRScannerButton } from './qr-scanner-button'
import { formatJapaneseName } from '@/lib/utils/name'
import { RealtimeCheckinInfo } from './realtime-checkin-info'
import { isAdmin } from '@/lib/utils/admin'
import { CheckinHistory } from './checkin-history'
import { UpcomingBookings } from './upcoming-bookings'
import { UnpaidCheckoutsWarning } from './unpaid-checkouts-warning'
import { getCached, cacheKey } from '@/lib/cache/vercel-kv'

// 💡 キャッシュ最適化: 20秒ごとに再検証（さらに高速化）
export const revalidate = 20

// 💡 Dynamic rendering optimization
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 今日の日付を計算
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()
  const todayStr = today.toISOString().split('T')[0]

  // 今月の開始日時と終了日時を計算
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0)
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

  // 🚀 並列化 + 💎 キャッシュ: 独立したクエリを同時実行
  // 💡 最適化: 必要なカラムだけ取得してデータ転送量を削減
  // 💡 Streaming: 重い履歴データは後から読み込む
  const [
    currentCheckinResult,
    todayCheckinsResult,
    userDataResult,
    currentPlanResult,
    adminResult,
    monthlyOvertimeResult,
  ] = await Promise.all([
    // 現在のチェックイン状態を取得（キャッシュしない：リアルタイム性が重要）
    supabase
      .from('checkins')
      .select('id, checkin_at, checkout_at, duration_minutes')
      .eq('user_id', user.id)
      .is('checkout_at', null)
      .maybeSingle(),
    // 今日のチェックイン履歴を取得（キャッシュしない：リアルタイム性が重要）
    supabase
      .from('checkins')
      .select('id, checkin_at, checkout_at, duration_minutes')
      .eq('user_id', user.id)
      .gte('checkin_at', todayStart)
      .order('checkin_at', { ascending: false })
      .limit(10),
    // ユーザー情報を取得（💎 キャッシュ: 5分間）
    getCached(
      cacheKey('user', user.id),
      async () => {
        const { data } = await supabase
          .from('users')
          .select('name, is_staff')
          .eq('id', user.id)
          .single()
        return data
      },
      300 // 5分
    ),
    // 現在のプラン情報を取得（💎 キャッシュ: 5分間）
    getCached(
      cacheKey('user_plan', user.id),
      async () => {
        const { data } = await supabase
          .from('user_plans')
          .select('started_at, plan_id, plans:plan_id(id, name, start_time, end_time, available_days)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('ended_at', null)
          .single()
        return data
      },
      300 // 5分
    ),
    // 管理者チェック（💎 キャッシュ: 10分間）
    getCached(
      cacheKey('is_admin', user.id),
      async () => isAdmin(),
      600 // 10分
    ),
    // 今月の時間外利用を取得（💎 キャッシュ: 1分間）
    getCached(
      cacheKey('monthly_overtime', user.id, currentMonthStart.toISOString().split('T')[0]),
      async () => {
        const { data } = await supabase
          .from('checkins')
          .select('overtime_fee')
          .eq('user_id', user.id)
          .eq('member_type_at_checkin', 'regular')
          .eq('is_overtime', true)
          .not('checkout_at', 'is', null)
          .gte('checkout_at', currentMonthStart.toISOString())
          .lte('checkout_at', currentMonthEnd.toISOString())
          .eq('overtime_fee_billed', false) // 未請求のもののみ
        return data
      },
      60 // 1分
    ),
  ])

  const { data: currentCheckin, error: checkinError } = currentCheckinResult
  const { data: todayCheckins } = todayCheckinsResult
  const userData = userDataResult // キャッシュから直接取得
  const currentPlan = currentPlanResult // キャッシュから直接取得
  const admin = adminResult // キャッシュから直接取得
  const monthlyOvertime = monthlyOvertimeResult || []

  // 今月の累計時間外利用料金を計算
  const monthlyOvertimeFee = monthlyOvertime.reduce((sum, checkin) => sum + (checkin.overtime_fee || 0), 0)

  if (checkinError) {
    console.error('Dashboard: Error fetching current checkin:', checkinError)
  }

  // 💡 Supabaseのネストされたクエリは配列を返すことがあるので、正規化
  const planData = currentPlan?.plans 
    ? (Array.isArray(currentPlan.plans) ? currentPlan.plans[0] : currentPlan.plans)
    : null

  // 今日の総利用時間を計算（チェックアウト済みのみ）
  const todayDuration = todayCheckins
    ?.filter((c) => c.checkout_at && c.duration_minutes)
    .reduce((sum, c) => sum + (c.duration_minutes || 0), 0) || 0

  // 利用者ユーザーの場合、staff_member_idを取得
  let staffMemberId = null
  if (userData?.is_staff === true) {
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    staffMemberId = staffMember?.id || null
  }

  const isCheckedIn = !!currentCheckin

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-room-charcoal">
              ダッシュボード
            </h1>
            <p className="mt-2 text-sm text-room-charcoal-light">
              ようこそ、{formatJapaneseName(userData?.name) || user.email} さん
            </p>
          </div>
          <div className="flex items-center gap-3">
            {admin && (
              <Link
                href="/admin"
                className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
              >
                管理者画面
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>

        {/* 未決済警告（ドロップイン会員向け） */}
        <Suspense fallback={null}>
          <UnpaidCheckoutsWarning />
        </Suspense>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* カード1: 現在の状態 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal">現在の状態</h2>
            {isCheckedIn ? (
              <>
                <p className="mt-2 text-sm font-medium text-room-main">
                  チェックイン中
                </p>
                {currentCheckin.checkin_at && (
                  <p className="mt-1 text-xs text-room-charcoal-light">
                    チェックイン時刻: {new Date(currentCheckin.checkin_at).toLocaleString('ja-JP')}
                  </p>
                )}
                {/* リアルタイム情報表示 */}
                {currentCheckin.checkin_at && (
                  <RealtimeCheckinInfo
                    checkinAt={currentCheckin.checkin_at}
                    memberType={currentPlan ? 'regular' : 'dropin'}
                    planInfo={planData ? {
                      name: planData.name || '',
                      startTime: planData.start_time || undefined,
                      endTime: planData.end_time || undefined,
                      availableDays: planData.available_days || undefined,
                    } : null}
                  />
                )}
                <QRScannerButton
                  mode="checkout"
                  buttonText="チェックアウト"
                  buttonClassName="mt-4 inline-block rounded-md bg-room-charcoal px-4 py-2 text-sm text-white hover:bg-room-charcoal-light"
                />
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-room-charcoal-light">
                  現在チェックイン中ではありません
                </p>
                <QRScannerButton
                  mode="checkin"
                  buttonText="チェックイン"
                  buttonClassName="mt-4 inline-block rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
                />
              </>
            )}
          </div>

          {/* カード2: 今日の利用状況 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal">今日の利用状況</h2>
            {todayDuration > 0 ? (
              <>
                <p className="mt-2 text-sm text-room-charcoal-light">
                  利用時間: {Math.floor(todayDuration / 60)}時間{todayDuration % 60}分
                </p>
                <p className="mt-1 text-xs text-room-charcoal-light">
                  チェックイン回数: {todayCheckins?.length || 0}回
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-room-charcoal-light">
                まだ利用していません
              </p>
            )}
          </div>

          {/* カード3: 今月の時間外利用料金（会員のみ） */}
          {planData && monthlyOvertimeFee > 0 && (
            <div className="rounded-lg bg-room-main bg-opacity-10 border-2 border-room-main p-6 shadow border-room-base-dark">
              <h2 className="text-lg font-semibold text-room-main-dark">今月の時間外利用料金</h2>
              <p className="mt-2 text-2xl font-bold text-room-main-dark">
                {monthlyOvertimeFee.toLocaleString()}円
              </p>
              <p className="mt-1 text-xs text-room-charcoal-light">
                翌月1日に決済されます
              </p>
            </div>
          )}

          {/* カード4: プラン情報 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal">プラン情報</h2>
            {currentPlan ? (
              <>
                <p className="mt-2 text-sm text-room-charcoal">
                  {planData?.name || 'プラン名不明'}
                </p>
                <p className="mt-1 text-xs text-room-charcoal-light">
                  利用形態:{' '}
                  {currentPlan ? 'Room8会員' : 'ドロップイン（非会員）'}
                </p>
                <p className="mt-1 text-xs text-room-charcoal-light">
                  契約開始日: {new Date(currentPlan.started_at).toLocaleDateString('ja-JP')}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-room-charcoal-light">
                  プラン未登録
                </p>
                <Link
                  href="/plans"
                  className="mt-3 inline-block rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
                >
                  プランを選択して契約する
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 💡 Streaming: 会議室予約と利用履歴を非同期で読み込み */}
        <Suspense fallback={<div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark animate-pulse h-32"></div>}>
          <UpcomingBookings userId={user.id} staffMemberId={staffMemberId} isStaff={userData?.is_staff === true} />
        </Suspense>

        <Suspense fallback={<div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark animate-pulse h-64"></div>}>
          <CheckinHistory userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}

