import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { LogoutButton } from './logout-button'
import { QRScannerButton } from './qr-scanner-button'
import { formatJapaneseName } from '@/lib/utils/name'
import { RealtimeCheckinInfo } from './realtime-checkin-info'
import { CheckinHistory } from './checkin-history'
import { UpcomingBookings } from './upcoming-bookings'
import { getD1Client } from '@/lib/db/d1-http-client'
import { cookies } from 'next/headers'

// 💡 キャッシュ最適化: 30秒ごとに再検証（リアルタイム性とパフォーマンスのバランス）
export const revalidate = 30

export default async function DashboardPage() {
  const db = getD1Client()

  // セッションからユーザーIDを取得（簡易実装）
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')
  
  if (!sessionCookie) {
    redirect('/login')
  }

  // TODO: セッション検証を実装
  const userId = sessionCookie.value // 簡易実装、後で改善

  // 今日の日付を計算
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()
  const todayStr = today.toISOString().split('T')[0]

  // 🚀 並列化: 独立したクエリを同時実行（最重要データのみ）
  // 💡 最適化: 必要なカラムだけ取得してデータ転送量を削減
  // 💡 Streaming: 重い履歴データは後から読み込む
  const [
    currentCheckin,
    todayCheckins,
    userData,
    currentPlan,
  ] = await Promise.all([
    // 現在のチェックイン状態を取得
    db.queryOne<any>(
      `SELECT id, checkin_at, checkout_at, duration_minutes
       FROM checkins
       WHERE user_id = ? AND checkout_at IS NULL
       LIMIT 1`,
      [userId]
    ),
    // 今日のチェックイン履歴を取得
    db.query<any>(
      `SELECT id, checkin_at, checkout_at, duration_minutes
       FROM checkins
       WHERE user_id = ? AND checkin_at >= ?
       ORDER BY checkin_at DESC
       LIMIT 10`,
      [userId, todayStart]
    ),
    // ユーザー情報を取得
    db.queryOne<any>(
      `SELECT member_type, name, is_staff, is_admin
       FROM users
       WHERE id = ?`,
      [userId]
    ),
    // 現在のプラン情報を取得
    db.queryOne<any>(
      `SELECT up.started_at, 
              p.id as plan_id, p.name as plan_name, 
              p.start_time, p.end_time, p.available_days
       FROM user_plans up
       JOIN plans p ON up.plan_id = p.id
       WHERE up.user_id = ? AND up.status = 'active' AND up.ended_at IS NULL
       LIMIT 1`,
      [userId]
    ),
  ])

  if (!userData) {
    redirect('/login')
  }

  // 今日の総利用時間を計算（チェックアウト済みのみ）
  const todayDuration = todayCheckins
    ?.filter((c) => c.checkout_at && c.duration_minutes)
    .reduce((sum, c) => sum + (c.duration_minutes || 0), 0) || 0

  // プランデータの正規化
  const planData = currentPlan ? {
    id: currentPlan.plan_id,
    name: currentPlan.plan_name,
    start_time: currentPlan.start_time,
    end_time: currentPlan.end_time,
    available_days: currentPlan.available_days ? JSON.parse(currentPlan.available_days) : null,
  } : null

  // 利用者ユーザーの場合、staff_member_idを取得
  let staffMemberId = null
  if (userData?.is_staff) {
    const staffMember = await db.queryOne<any>(
      `SELECT id FROM staff_members WHERE auth_user_id = ? LIMIT 1`,
      [userId]
    )
    staffMemberId = staffMember?.id || null
  }

  const isCheckedIn = !!currentCheckin
  const admin = userData?.is_admin || false

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-room-charcoal">
              ダッシュボード
            </h1>
            <p className="mt-2 text-sm text-room-charcoal-light">
              ようこそ、{formatJapaneseName(userData?.name) || 'ゲスト'} さん
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

          {/* カード3: プラン情報 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal">プラン情報</h2>
            {currentPlan ? (
              <>
                <p className="mt-2 text-sm text-room-charcoal">
                  {planData?.name || 'プラン名不明'}
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

        {/* 💡 Streaming: 会議室予約と利用履歴を非同期で読み込み */}
        <Suspense fallback={<div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark animate-pulse h-32"></div>}>
          <UpcomingBookings userId={userId} staffMemberId={staffMemberId} isStaff={userData?.is_staff === 1} />
        </Suspense>

        <Suspense fallback={<div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark animate-pulse h-64"></div>}>
          <CheckinHistory userId={userId} />
        </Suspense>
      </div>
    </div>
  )
}

