import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from './logout-button'
import { QRScannerButton } from './qr-scanner-button'
import { formatJapaneseName } from '@/lib/utils/name'
import { RealtimeCheckinInfo } from './realtime-checkin-info'
import { isAdmin } from '@/lib/utils/admin'

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

  // 🚀 並列化: 独立したクエリを同時実行
  const [
    currentCheckinResult,
    todayCheckinsResult,
    checkinHistoryResult,
    userDataResult,
    currentPlanResult,
    adminResult,
  ] = await Promise.all([
    // 現在のチェックイン状態を取得
    supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id)
      .is('checkout_at', null)
      .maybeSingle(),
    // 今日のチェックイン履歴を取得
    supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id)
      .gte('checkin_at', todayStart)
      .order('checkin_at', { ascending: false })
      .limit(10),
    // 利用履歴を取得（最新30件）
    supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id)
      .order('checkin_at', { ascending: false })
      .limit(30),
    // ユーザー情報を取得
    supabase
      .from('users')
      .select('member_type, name, is_staff')
      .eq('id', user.id)
      .single(),
    // 現在のプラン情報を取得
    supabase
      .from('user_plans')
      .select('*, plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single(),
    // 管理者チェック
    isAdmin(),
  ])

  const { data: currentCheckin, error: checkinError } = currentCheckinResult
  const { data: todayCheckins } = todayCheckinsResult
  const { data: checkinHistory } = checkinHistoryResult
  const { data: userData } = userDataResult
  const { data: currentPlan } = currentPlanResult
  const admin = adminResult

  if (checkinError) {
    console.error('Dashboard: Error fetching current checkin:', checkinError)
  }

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

  // 会議室予約一覧を取得（今後の予約のみ、最新5件）
  let upcomingBookingsQuery = supabase
    .from('meeting_room_bookings')
    .select('*')
    .in('status', ['reserved', 'confirmed'])
    .gte('booking_date', todayStr)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5)

  if (userData?.is_staff === true && staffMemberId) {
    // 利用者ユーザーの場合、user_idまたはstaff_member_idでフィルタ
    upcomingBookingsQuery = upcomingBookingsQuery.or(`user_id.eq.${user.id},staff_member_id.eq.${staffMemberId}`)
  } else {
    // 通常ユーザーの場合、user_idでフィルタ
    upcomingBookingsQuery = upcomingBookingsQuery.eq('user_id', user.id)
  }

  const { data: upcomingBookings } = await upcomingBookingsQuery

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
                    memberType={currentPlan ? 'regular' : (userData?.member_type || 'dropin')}
                    planInfo={currentPlan?.plans ? {
                      name: currentPlan.plans.name || '',
                      startTime: currentPlan.plans.start_time || undefined,
                      endTime: currentPlan.plans.end_time || undefined,
                      availableDays: currentPlan.plans.available_days || undefined,
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

          {/* カード3: プラン情報 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal">プラン情報</h2>
            {currentPlan ? (
              <>
                <p className="mt-2 text-sm text-room-charcoal">
                  {currentPlan.plans?.name || 'プラン名不明'}
                </p>
                <p className="mt-1 text-xs text-room-charcoal-light">
                  利用形態: {
                    currentPlan || userData?.member_type === 'regular'
                      ? 'Room8会員'
                      : 'ドロップイン（非会員）'
                  }
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

        {/* 会議室予約状況セクション */}
        {upcomingBookings && upcomingBookings.length > 0 && (
          <div className="mt-8">
            <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-room-charcoal">今後の会議室予約</h2>
                <Link
                  href="/meeting-rooms"
                  className="text-sm text-room-main hover:text-room-main-light"
                >
                  全て見る →
                </Link>
              </div>
              <div className="space-y-3">
                {upcomingBookings.map((booking) => {
                  const bookingDate = new Date(booking.booking_date)
                  const statusMap: Record<string, { label: string; className: string }> = {
                    reserved: { label: '予約済み', className: 'bg-room-main bg-opacity-20 text-room-main' },
                    confirmed: { label: '確定', className: 'bg-room-wood bg-opacity-20 text-room-wood' },
                  }
                  const statusInfo = statusMap[booking.status] || { label: booking.status, className: 'bg-gray-100 text-gray-800' }
                  
                  return (
                    <div
                      key={booking.id}
                      className="rounded-md border border-room-base-dark bg-room-base p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-room-charcoal">
                              {bookingDate.toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short',
                              })}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-sm text-room-charcoal-light">
                            <span className="mr-4">
                              {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                            </span>
                            <span>
                              {Math.floor(booking.duration_hours)}時間{Math.round((booking.duration_hours % 1) * 60)}分
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-room-charcoal">
                            ¥{booking.total_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 利用履歴セクション */}
        <div className="mt-8">
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="mb-4 text-lg font-semibold text-room-charcoal">利用履歴</h2>
            {checkinHistory && checkinHistory.length > 0 ? (
              <div className="space-y-3">
                {checkinHistory.map((checkin) => {
                  const checkinAt = new Date(checkin.checkin_at)
                  const checkoutAt = checkin.checkout_at ? new Date(checkin.checkout_at) : null
                  const duration = checkin.duration_minutes || null
                  
                  return (
                    <div
                      key={checkin.id}
                      className="rounded-md border border-room-base-dark bg-room-base p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-room-charcoal">
                              {checkinAt.toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                            {!checkoutAt && (
                              <span className="rounded-full bg-room-main bg-opacity-20 px-2 py-0.5 text-xs font-medium text-room-main">
                                チェックイン中
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-room-charcoal-light">
                            <span className="mr-4">
                              入室: {checkinAt.toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {checkoutAt && (
                              <span>
                                退室: {checkoutAt.toLocaleTimeString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                             <div className="mt-2 text-right sm:mt-0">
                               {duration !== null ? (
                                 <div className="text-sm text-room-charcoal">
                                   <span className="font-medium">
                                     {Math.floor(duration / 60)}時間{duration % 60}分
                                   </span>
                                 </div>
                               ) : checkoutAt ? (
                                 <div className="text-xs text-room-charcoal-light">時間未計算</div>
                               ) : (
                                 <div className="text-xs text-room-charcoal-light">利用中</div>
                               )}
                             </div>
                      </div>
                    </div>
                  )
                })}
              </div>
                 ) : (
                   <p className="text-sm text-room-charcoal-light">利用履歴がありません</p>
                 )}
          </div>
        </div>
      </div>
    </div>
  )
}

