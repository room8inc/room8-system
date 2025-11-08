import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookingForm } from './booking-form'
import { BookingList } from './booking-list'
import { getCached, cacheKey } from '@/lib/cache/vercel-kv'

// 💡 キャッシュ最適化: 60秒ごとに再検証
export const revalidate = 60

export default async function MeetingRoomsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 🚀 並列化 + 💎 キャッシュ: 独立したクエリを同時実行
  // 💡 最適化: 必要なカラムだけ取得
  const [userData, meetingRoom] = await Promise.all([
    // ユーザー情報を取得（💎 キャッシュ: 5分間）
    getCached(
      cacheKey('user', user.id),
      async () => {
        const { data } = await supabase
          .from('users')
          .select('member_type, is_staff')
          .eq('id', user.id)
          .single()
        return data
      },
      300 // 5分
    ),
    // 会議室情報を取得（💎 キャッシュ: 10分間）
    getCached(
      cacheKey('meeting_room', 'room8-meeting-room-001'),
      async () => {
        const { data } = await supabase
          .from('meeting_rooms')
          .select('id, code, name, capacity, hourly_rate_regular, hourly_rate_non_regular')
          .eq('code', 'room8-meeting-room-001')
          .single()
        return data
      },
      600 // 10分
    ),
  ])

  // 利用者ユーザーの場合、法人ユーザーのプラン情報を取得
  let currentPlan: any = null
  let planData: any = null
  let billingUserId = user.id // 決済を行うユーザーID（デフォルトは自分）
  let staffMemberId = null

  if (userData?.is_staff === true) {
    // 利用者の場合、staff_membersテーブルから法人ユーザーIDを取得（💎 キャッシュ: 10分間）
    const staffMember = await getCached(
      cacheKey('staff_member', user.id),
      async () => {
        const { data } = await supabase
          .from('staff_members')
          .select('id, company_user_id')
          .eq('auth_user_id', user.id)
          .single()
        return data
      },
      600 // 10分
    )

    if (staffMember) {
      staffMemberId = staffMember.id
      billingUserId = staffMember.company_user_id // 決済は法人ユーザー
      
      // 法人ユーザーのプラン情報を取得（💎 キャッシュ: 5分間）
      const companyPlan = await getCached(
        cacheKey('user_plan', billingUserId),
        async () => {
          const { data } = await supabase
            .from('user_plans')
            .select('id, plan_id, plans:plan_id(id, name, features)')
            .eq('user_id', billingUserId)
            .eq('status', 'active')
            .is('ended_at', null)
            .single()
          return data
        },
        300 // 5分
      )
      
      currentPlan = companyPlan
      // 💡 Supabaseのネストされたクエリは配列を返すことがあるので、正規化
      planData = companyPlan?.plans 
        ? (Array.isArray(companyPlan.plans) ? companyPlan.plans[0] : companyPlan.plans)
        : null
    }
  } else {
    // 通常ユーザーの場合、自分のプラン情報を取得（💎 キャッシュ: 5分間）
    const plan = await getCached(
      cacheKey('user_plan', user.id),
      async () => {
        const { data } = await supabase
          .from('user_plans')
          .select('id, plan_id, plans:plan_id(id, name, features)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('ended_at', null)
          .single()
        return data
      },
      300 // 5分
    )
    
    currentPlan = plan
    // 💡 Supabaseのネストされたクエリは配列を返すことがあるので、正規化
    planData = plan?.plans 
      ? (Array.isArray(plan.plans) ? plan.plans[0] : plan.plans)
      : null
  }

  if (!meetingRoom) {
    // 会議室が存在しない場合はエラー（マイグレーションが実行されていない可能性）
    return (
      <div className="min-h-screen bg-room-base">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-room-main-dark">
              会議室情報が取得できませんでした。データベースのマイグレーションを確認してください。
            </p>
          </div>
        </div>
      </div>
    )
  }

      // 料金を計算
      const calculateRate = () => {
        // プラン契約がない場合はRoom8会員以外として扱う
        if (!currentPlan) {
          // Room8会員以外：1時間2,200円
          return {
            rate: meetingRoom.hourly_rate_non_regular || 2200,
            freeHours: 0,
          }
        }

    if (planData) {
      // シェアオフィスプランのチェック（features.type === 'shared_office'）
      const features = planData.features as any
      if (features?.type === 'shared_office') {
        // シェアオフィスプラン：月4時間まで無料、超過分1,100円/時間
        return {
          rate: meetingRoom.hourly_rate_regular || 1100,
          freeHours: 4,
          note: '月4時間まで無料',
        }
      }
    }

    // Room8会員（一般）：1時間1,100円
    return {
      rate: meetingRoom.hourly_rate_regular || 1100,
      freeHours: 0,
    }
  }

  const rateInfo = calculateRate()

  // ユーザーの予約一覧を取得（最新順）
  // 💡 最適化: 必要なカラムだけ取得 + 💎 キャッシュ: 30秒（リアルタイム性を保ちつつ高速化）
  const cacheKeyForBookings = userData?.is_staff === true && staffMemberId
    ? cacheKey('bookings', user.id, staffMemberId)
    : cacheKey('bookings', user.id)

  let userBookings: any[] | null = null
  try {
    userBookings = await getCached(
      cacheKeyForBookings,
      async () => {
        let userBookingsQuery = supabase
          .from('meeting_room_bookings')
          .select('id, booking_date, start_time, end_time, duration_hours, total_amount, status, google_calendar_event_id, user_id, staff_member_id')
          .neq('status', 'cancelled')
          .order('booking_date', { ascending: false })
          .order('start_time', { ascending: false })
          .limit(20)

        if (userData?.is_staff === true && staffMemberId) {
          // 利用者ユーザーの場合、user_idまたはstaff_member_idでフィルタ
          // ダッシュボードと完全に同じ方法を使用
          userBookingsQuery = userBookingsQuery.or(`user_id.eq.${user.id},staff_member_id.eq.${staffMemberId}`)
        } else {
          // 通常ユーザーの場合、user_idでフィルタ
          userBookingsQuery = userBookingsQuery.eq('user_id', user.id)
        }

        const { data, error } = await userBookingsQuery
        if (error) {
          console.error('Booking fetch error:', error)
          return null
        }
        return data
      },
      30 // 30秒（リアルタイム性を保ちつつ高速化）
    )
  } catch (error) {
    console.error('Booking fetch error:', error)
    userBookings = null
  }
  
  // 💡 本番環境ではデバッグログを削減
  // google_calendar_event_idも含めて取得（必要に応じて）
  const bookingsWithCalendarId = userBookings?.map((booking: any) => ({
    ...booking,
    google_calendar_event_id: booking.google_calendar_event_id || null
  })) || []

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
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            会議室予約
          </h1>
        </div>

        {/* 会議室情報カード */}
        <div className="mb-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-room-charcoal mb-2">
                会議室
              </h2>
              <p className="text-sm text-room-charcoal-light">
                1室のみの会議室をご利用いただけます
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-room-charcoal-light mb-1">料金</p>
              <p className="text-lg font-bold text-room-main">
                ¥{rateInfo.rate.toLocaleString()}/時間
              </p>
              {rateInfo.freeHours > 0 && (
                <p className="text-xs text-room-charcoal-light mt-1">
                  {rateInfo.note}
                </p>
              )}
              <p className="text-xs text-room-charcoal-light mt-1">
                定員: {meetingRoom.capacity}名
              </p>
            </div>
          </div>
        </div>

        {/* 予約フォーム */}
        <div className="mb-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h3 className="text-lg font-semibold text-room-charcoal mb-4">
            新規予約
          </h3>
            <BookingForm
              userId={user.id}
              memberType={currentPlan ? 'regular' : (userData?.member_type || 'dropin')}
            planInfo={planData ? {
              id: planData.id,
              features: planData.features,
            } : null}
            hourlyRate={rateInfo.rate}
            freeHours={rateInfo.freeHours}
            meetingRoomId={meetingRoom.id}
            billingUserId={billingUserId}
            staffMemberId={staffMemberId}
          />
        </div>

        {/* 予約一覧 */}
        <div className="mb-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h3 className="text-lg font-semibold text-room-charcoal mb-4">
            予約一覧
          </h3>
          <BookingList
            bookings={bookingsWithCalendarId}
            userId={user.id}
          />
        </div>

        {/* 料金体系の説明 */}
        <div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h3 className="text-lg font-semibold text-room-charcoal mb-4">
            料金体系
          </h3>
          <div className="space-y-4">
            <div className="border-l-4 border-room-main pl-4">
              <p className="font-medium text-room-charcoal">
                Room8会員（シェアオフィスプラン）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                月4時間まで無料、超過分：¥1,100/時間
              </p>
            </div>
            <div className="border-l-4 border-room-wood pl-4">
              <p className="font-medium text-room-charcoal">
                Room8会員（一般）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                ¥1,100/時間
              </p>
            </div>
            <div className="border-l-4 border-room-brass pl-4">
              <p className="font-medium text-room-charcoal">
                ドロップイン（非会員）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                ¥2,200/時間
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-room-base-dark">
            <p className="text-xs text-room-charcoal-light">
              <strong>決済タイミング：</strong>
              <br />
              Room8会員：時間外利用と合算して月末（翌月1日）にまとめて請求
              <br />
              ドロップイン（非会員）：予約時に決済
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

