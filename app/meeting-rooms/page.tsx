import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookingForm } from './booking-form'
import { BookingList } from './booking-list'

export default async function MeetingRoomsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ユーザー情報を取得
  const { data: userData } = await supabase
    .from('users')
    .select('member_type, is_staff')
    .eq('id', user.id)
    .single()

  // 利用者ユーザーの場合、法人ユーザーのプラン情報を取得
  let currentPlan = null
  let billingUserId = user.id // 決済を行うユーザーID（デフォルトは自分）
  let staffMemberId = null

  if (userData?.is_staff === true) {
    // 利用者の場合、staff_membersテーブルから法人ユーザーIDを取得
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('id, company_user_id')
      .eq('auth_user_id', user.id)
      .single()

    if (staffMember) {
      staffMemberId = staffMember.id
      billingUserId = staffMember.company_user_id // 決済は法人ユーザー
      
      // 法人ユーザーのプラン情報を取得
      const { data: companyPlan } = await supabase
        .from('user_plans')
        .select('*, plans(*)')
        .eq('user_id', billingUserId)
        .eq('status', 'active')
        .is('ended_at', null)
        .single()
      
      currentPlan = companyPlan
    }
  } else {
    // 通常ユーザーの場合、自分のプラン情報を取得
    const { data: plan } = await supabase
      .from('user_plans')
      .select('*, plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single()
    
    currentPlan = plan
  }

  // 会議室情報を取得
  const { data: meetingRoom } = await supabase
    .from('meeting_rooms')
    .select('*')
    .eq('code', 'room8-meeting-room-001')
    .single()

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
        // プラン契約がない場合は定額会員以外として扱う
        if (!currentPlan) {
          // 定額会員以外：1時間2,200円
          return {
            rate: meetingRoom.hourly_rate_non_regular || 2200,
            freeHours: 0,
          }
        }

    if (currentPlan?.plans) {
      // シェアオフィスプランのチェック（features.type === 'shared_office'）
      const features = currentPlan.plans.features as any
      if (features?.type === 'shared_office') {
        // シェアオフィスプラン：月4時間まで無料、超過分1,100円/時間
        return {
          rate: meetingRoom.hourly_rate_regular || 1100,
          freeHours: 4,
          note: '月4時間まで無料',
        }
      }
    }

    // 定額会員（一般）：1時間1,100円
    return {
      rate: meetingRoom.hourly_rate_regular || 1100,
      freeHours: 0,
    }
  }

  const rateInfo = calculateRate()

  // ユーザーの予約一覧を取得（最新順）
  // ダッシュボードと同じ方法で取得
  let userBookingsQuery = supabase
    .from('meeting_room_bookings')
    .select('*, google_calendar_event_id')
    .neq('status', 'cancelled')
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(20)

  if (userData?.is_staff === true && staffMemberId) {
    // 利用者ユーザーの場合、user_idまたはstaff_member_idでフィルタ
    // ダッシュボードと同じ方法を使用
    userBookingsQuery = userBookingsQuery.or(`user_id.eq.${user.id},staff_member_id.eq.${staffMemberId}`)
  } else {
    // 通常ユーザーの場合、user_idでフィルタ
    userBookingsQuery = userBookingsQuery.eq('user_id', user.id)
  }

  const { data: userBookings, error: bookingsError } = await userBookingsQuery
  
  if (bookingsError) {
    console.error('Booking fetch error:', bookingsError)
  }
  
  console.log('Bookings count:', userBookings?.length || 0)

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
            planInfo={currentPlan?.plans ? {
              id: currentPlan.plans.id,
              features: currentPlan.plans.features,
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
            bookings={userBookings || []}
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
                定額会員（シェアオフィスプラン）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                月4時間まで無料、超過分：¥1,100/時間
              </p>
            </div>
            <div className="border-l-4 border-room-wood pl-4">
              <p className="font-medium text-room-charcoal">
                定額会員（一般）
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

