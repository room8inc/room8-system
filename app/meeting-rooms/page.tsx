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
    if (userData?.member_type !== 'regular') {
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
  const { data: userBookings } = await supabase
    .from('meeting_room_bookings')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(20)

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
            memberType={userData?.member_type || 'regular'}
            planInfo={currentPlan?.plans ? {
              id: currentPlan.plans.id,
              features: currentPlan.plans.features,
            } : null}
            hourlyRate={rateInfo.rate}
            freeHours={rateInfo.freeHours}
            meetingRoomId={meetingRoom.id}
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
                定額会員以外（ドロップイン会員など）
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
              定額会員：時間外利用と合算して月末（翌月1日）にまとめて請求
              <br />
              ドロップイン会員：予約時に決済
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

