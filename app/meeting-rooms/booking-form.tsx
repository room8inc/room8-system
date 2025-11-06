'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { AvailabilityCalendar } from './availability-calendar'

// Stripe公開キーを読み込み
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

// 決済フォームコンポーネント
function PaymentForm({
  clientSecret,
  paymentIntentId,
  bookingId,
  amount,
  onSuccess,
  onError,
}: {
  clientSecret: string
  paymentIntentId: string | null
  bookingId: string | undefined
  amount: number
  onSuccess: () => void
  onError: (errorMessage: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || processing) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const cardNumberElement = elements.getElement(CardNumberElement)
      const cardExpiryElement = elements.getElement(CardExpiryElement)
      const cardCvcElement = elements.getElement(CardCvcElement)

      if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
        setError('カード情報が見つかりません')
        setProcessing(false)
        return
      }

      // 決済を実行
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            // 必要に応じて請求先情報を追加
          },
        },
      })

      if (confirmError) {
        setError(confirmError.message || '決済に失敗しました')
        onError(confirmError.message || '決済に失敗しました')
        setProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        // 決済成功後、予約の決済状態を更新
        const supabase = createClient()
        const { error: updateError } = await supabase
          .from('meeting_room_bookings')
          .update({
            payment_status: 'paid',
            payment_date: new Date().toISOString(),
          })
          .eq('id', bookingId)

        if (updateError) {
          console.error('Payment status update error:', updateError)
          // 決済は成功しているが、状態更新に失敗した場合は警告
          alert('決済は完了しましたが、予約状態の更新に失敗しました。管理者にお問い合わせください。')
          setError('決済は完了しましたが、予約状態の更新に失敗しました。管理者にお問い合わせください。')
          setProcessing(false)
          return
        }

        // 決済成功後、Googleカレンダーにイベントを追加
        try {
          const bookingResponse = await supabase
            .from('meeting_room_bookings')
            .select('booking_date, start_time, end_time, notes, user_id')
            .eq('id', bookingId)
            .single()

          if (bookingResponse.data) {
            const booking = bookingResponse.data
            const userData = await supabase
              .from('users')
              .select('name, email')
              .eq('id', booking.user_id)
              .single()

            const userName = userData.data?.name || '会員'
            const eventTitle = `会議室予約 - ${userName}`
            const eventDescription = `会員: ${userName}\n予約日: ${booking.booking_date}\n利用時間: ${booking.start_time} - ${booking.end_time}\n備考: ${booking.notes || 'なし'}`

            const calendarEventResponse = await fetch('/api/calendar/create-event', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                date: booking.booking_date,
                startTime: booking.start_time,
                endTime: booking.end_time,
                title: eventTitle,
                description: eventDescription,
              }),
            })

            if (calendarEventResponse.ok) {
              const calendarResult = await calendarEventResponse.json()
              // GoogleカレンダーのイベントIDを保存
              await supabase
                .from('meeting_room_bookings')
                .update({ google_calendar_event_id: calendarResult.eventId })
                .eq('id', bookingId)
            }
          }
        } catch (calendarError) {
          console.error('Google Calendar event creation error:', calendarError)
          // Googleカレンダーへの追加が失敗しても、決済は成功しているので続行
        }

        onSuccess()
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      const errorMessage = err.message || '決済中にエラーが発生しました'
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
          <p className="text-sm text-room-main-dark">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-room-charcoal mb-2">
            カード番号
          </label>
          <div className="rounded-md border border-room-base-dark bg-room-base px-3 py-2">
            <CardNumberElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-room-charcoal mb-2">
              有効期限
            </label>
            <div className="rounded-md border border-room-base-dark bg-room-base px-3 py-2">
              <CardExpiryElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-room-charcoal mb-2">
              CVC
            </label>
            <div className="rounded-md border border-room-base-dark bg-room-base px-3 py-2">
              <CardCvcElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-room-base-dark">
        <button
          type="button"
          onClick={() => {
            setError(null)
            onError('決済をキャンセルしました')
          }}
          disabled={processing}
          className="px-4 py-2 text-sm rounded-md border border-room-base-dark text-room-charcoal hover:bg-room-base disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="px-4 py-2 text-sm rounded-md bg-room-main text-white hover:bg-room-main-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? '決済中...' : `¥${amount.toLocaleString()}を支払う`}
        </button>
      </div>
    </form>
  )
}

interface BookingFormProps {
  userId: string
  memberType: 'regular' | 'dropin' | 'guest'
  planInfo?: {
    id: string
    features?: any
  } | null
  hourlyRate: number
  freeHours?: number
  meetingRoomId: string
  billingUserId?: string // 決済を行うユーザーID（利用者の場合は法人ユーザーID）
  staffMemberId?: string | null // 利用者のID（利用者が予約した場合）
}

export function BookingForm({
  userId,
  memberType,
  planInfo,
  hourlyRate,
  freeHours,
  meetingRoomId,
  billingUserId,
  staffMemberId,
}: BookingFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null) // Stripe決済用
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null) // Stripe決済用
  const [pendingBooking, setPendingBooking] = useState<any>(null) // 決済待ちの予約情報

  const [formData, setFormData] = useState({
    bookingDate: '',
    startTime: '',
    durationHours: 1, // デフォルトは1時間
    notes: '',
  })

  // 選択された時刻（時間のみ、分は未選択）
  const [selectedHour, setSelectedHour] = useState<string | null>(null)
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null) // 選択された分（0または30）
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availableMinutes, setAvailableMinutes] = useState<{ '0': boolean; '30': boolean } | null>(null)
  const [maxAvailableDuration, setMaxAvailableDuration] = useState<number | null>(null) // 選択時刻から利用可能な最大時間

  // 営業時間の終了時刻（例: 22:00）。この時刻を超える終了は不可とする。
  const BUSINESS_CLOSE_TIME = '22:00'

  // 今日以降の日付のみ選択可能
  const today = new Date().toISOString().split('T')[0]

  // 利用時間の選択肢を生成（1時間から6時間まで、30分刻み）
  const durationOptions = []
  for (let hours = 1; hours <= 6; hours++) {
    durationOptions.push(hours) // 1時間、2時間、3時間...
    if (hours < 6) {
      durationOptions.push(hours + 0.5) // 1時間30分、2時間30分...
    }
  }

  // 選択された開始時刻に基づいて利用可能な時間のみフィルタリング
  const availableDurationOptions = maxAvailableDuration !== null
    ? durationOptions.filter(hours => hours <= maxAvailableDuration)
    : durationOptions

  // 利用時間から終了時刻を計算
  const calculateEndTime = (startTime: string, durationHours: number): string => {
    if (!startTime) return ''
    
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + durationHours * 60
    const endHours = Math.floor(totalMinutes / 60) % 24
    const endMins = totalMinutes % 60
    
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
  }

  // 利用時間を表示用の文字列に変換
  const formatDuration = (hours: number): string => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours % 1) * 60)
    
    if (minutes === 0) {
      return `${wholeHours}時間`
    } else {
      return `${wholeHours}時間${minutes}分`
    }
  }

  const duration = formData.durationHours || 0
  const endTime = formData.startTime ? calculateEndTime(formData.startTime, duration) : ''

  const calculateAmount = () => {
    const duration = formData.durationHours || 0
    if (duration <= 0) return 0

    // シェアオフィスプランの場合、無料枠を考慮（後で実装）
    // 今は簡易版として、全時間を有料として計算
    const totalAmount = duration * hourlyRate
    return Math.ceil(totalAmount)
  }

  const checkAvailability = async () => {
    if (!formData.bookingDate || !formData.startTime || !formData.durationHours) {
      return { available: false, reason: '日時が選択されていません' }
    }

    const endTime = calculateEndTime(formData.startTime, formData.durationHours)

    try {
      // 1. データベース内の既存予約をチェック
      const { data: existingBookings, error: checkError } = await supabase
        .from('meeting_room_bookings')
        .select('*')
        .eq('meeting_room_id', meetingRoomId)
        .eq('booking_date', formData.bookingDate)
        .in('status', ['reserved', 'confirmed', 'in_use'])

      if (checkError) {
        console.error('Availability check error:', checkError)
        return { available: false, reason: '空き状況の確認に失敗しました' }
      }

      // クライアント側で時間の重複をチェック
      if (existingBookings) {
        const requestStart = formData.startTime
        const requestEnd = endTime

        const hasOverlap = existingBookings.some((booking) => {
          const bookingStart = booking.start_time
          const bookingEnd = booking.end_time
          // 時間が重複しているかチェック
          return requestStart < bookingEnd && requestEnd > bookingStart
        })

        if (hasOverlap) {
          return { available: false, reason: 'この時間帯は既に予約されています' }
        }
      }

      // 2. Googleカレンダーをチェック（DBキャッシュから）
      const { data: calendarEvents, error: calendarError } = await supabase
        .from('google_calendar_events_cache')
        .select('*')
        .gte('start_time', new Date(`${formData.bookingDate}T${formData.startTime}:00+09:00`).toISOString())
        .lte('end_time', new Date(`${formData.bookingDate}T${endTime}:00+09:00`).toISOString())

      if (calendarError) {
        console.error('Googleカレンダーイベント取得エラー:', calendarError)
        return { available: false, reason: 'Googleカレンダーの確認に失敗しました' }
      }

      if (calendarEvents && calendarEvents.length > 0) {
        // イベントとの重複をチェック
        const hasOverlap = calendarEvents.some((event: any) => {
          const eventStart = new Date(event.start_time)
          const eventEnd = new Date(event.end_time)
          const requestStart = new Date(`${formData.bookingDate}T${formData.startTime}:00+09:00`)
          const requestEnd = new Date(`${formData.bookingDate}T${endTime}:00+09:00`)

          return requestStart.getTime() < eventEnd.getTime() && requestEnd.getTime() > eventStart.getTime()
        })

        if (hasOverlap) {
          return { available: false, reason: 'Googleカレンダーに予定あり' }
        }
      }

      return { available: true }
    } catch (err) {
      console.error('Availability check error:', err)
      return { available: false, reason: '空き状況の確認中にエラーが発生しました' }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // バリデーション
    if (!formData.bookingDate || !formData.startTime || !formData.durationHours) {
      setError('日時と利用時間を選択してください')
      return
    }
    // モーダルを表示
    setShowConfirmModal(true)
  }

  const handleConfirmBooking = async () => {
    // 非会員の場合は決済フォームを表示するため、モーダルは開いたままにする
    // setShowConfirmModal(false) は削除
    setError(null)
    setLoading(true)

    try {
      const duration = formData.durationHours
      const endTime = calculateEndTime(formData.startTime, duration)

      // 空き状況確認
      const availability = await checkAvailability()
      if (!availability.available) {
        setError(availability.reason || 'この時間帯は予約できません')
        setLoading(false)
        return
      }

      // 料金計算
      const totalAmount = calculateAmount()

      // シェアオフィスプランかチェック
      const isSharedOffice = planInfo?.features?.type === 'shared_office'

      // 今月の無料枠使用状況を取得（シェアオフィスプランの場合）
      // 利用者の場合は法人ユーザーの使用状況を確認
      const checkUserId = billingUserId || userId
      let freeHoursUsed = 0
      if (isSharedOffice && freeHours) {
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const { data: monthlyBookings } = await supabase
          .from('meeting_room_bookings')
          .select('free_hours_used, duration_hours')
          .eq('billing_user_id', checkUserId) // 決済ユーザーIDで確認
          .eq('is_shared_office_plan', true)
          .gte('booking_date', firstDayOfMonth.toISOString().split('T')[0])
          .lte('booking_date', lastDayOfMonth.toISOString().split('T')[0])
          .in('status', ['reserved', 'confirmed', 'in_use', 'completed'])

        if (monthlyBookings) {
          freeHoursUsed = monthlyBookings.reduce(
            (sum, booking) => sum + (Number(booking.free_hours_used) || 0),
            0
          )
        }
      }

      // 無料枠の計算
      let actualFreeHoursUsed = 0
      let actualAmount = totalAmount
      if (isSharedOffice && freeHours) {
        const remainingFreeHours = freeHours - freeHoursUsed
        if (remainingFreeHours > 0) {
          actualFreeHoursUsed = Math.min(duration, remainingFreeHours)
          const chargeableHours = Math.max(0, duration - actualFreeHoursUsed)
          actualAmount = Math.ceil(chargeableHours * hourlyRate)
        }
      }

      // 決済状態とbilling_monthを設定
      const isMember = memberType === 'regular'
      const now = new Date()
      const billingMonth = isMember 
        ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] // 今月の1日
        : null

      // 予約を作成
      const { data: booking, error: insertError } = await supabase
        .from('meeting_room_bookings')
        .insert({
          meeting_room_id: meetingRoomId,
          user_id: userId, // 予約したユーザー（利用者の場合は利用者のID）
          billing_user_id: billingUserId || userId, // 決済を行うユーザー（利用者の場合は法人ユーザーID）
          staff_member_id: staffMemberId || null, // 利用者のID（利用者が予約した場合）
          booking_date: formData.bookingDate,
          start_time: formData.startTime,
          end_time: endTime,
          duration_hours: duration,
          number_of_participants: 1, // 一室貸し切りのため人数は1
          status: 'reserved',
          member_type_at_booking: memberType,
          plan_id_at_booking: planInfo?.id || null,
          is_shared_office_plan: isSharedOffice,
          hourly_rate: hourlyRate,
          total_amount: actualAmount,
          free_hours_used: actualFreeHoursUsed,
          notes: formData.notes || null,
          payment_status: isMember ? 'pending' : 'pending', // 会員も非会員も最初はpending
          billing_month: billingMonth, // 会員の場合は今月の1日を設定
        })
        .select()
        .single()

      if (insertError) {
        console.error('Booking insert error:', insertError)
        setError(`予約の作成に失敗しました: ${insertError.message}`)
        setLoading(false)
        return
      }

      // 非会員の場合：即時決済を実行
      if (!isMember && actualAmount > 0) {
        console.log('=== Starting payment process for non-member ===')
        console.log('Booking details:', {
          bookingId: booking.id,
          amount: actualAmount,
          billingUserId: billingUserId || userId,
          isMember,
          actualAmount
        })

        // Payment Intentを作成
        console.log('Calling /api/meeting-rooms/create-payment-intent')
        const paymentResponse = await fetch('/api/meeting-rooms/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingId: booking.id,
            amount: actualAmount,
            billingUserId: billingUserId || userId,
          }),
        })

        console.log('Payment response status:', paymentResponse.status, paymentResponse.statusText)

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json()
          console.error('Payment Intent creation error:', errorData)
          setError(`決済の準備に失敗しました: ${errorData.error || '不明なエラー'}`)
          setLoading(false)
          return
        }

        const paymentData = await paymentResponse.json()
        console.log('Payment Intent created successfully:', {
          hasClientSecret: !!paymentData.clientSecret,
          paymentIntentId: paymentData.paymentIntentId
        })
        
        console.log('Setting state variables...')
        setClientSecret(paymentData.clientSecret)
        setPaymentIntentId(paymentData.paymentIntentId)
        setPendingBooking(booking)
        setLoading(false)
        
        console.log('=== Payment form should be displayed now ===')
        console.log('Current state:', {
          clientSecret: !!paymentData.clientSecret,
          paymentIntentId: paymentData.paymentIntentId,
          pendingBookingId: booking.id,
          showConfirmModal: true // モーダルは開いたまま
        })
        return
      }

      // 会員の場合は予約完了処理を続行（Googleカレンダーへの追加など）
      // Googleカレンダーにイベントを追加
      try {
        const userData = await supabase
          .from('users')
          .select('name, email')
          .eq('id', userId)
          .single()

        const userName = userData.data?.name || '会員'
        const eventTitle = `会議室予約 - ${userName}`
        const eventDescription = `会員: ${userName}\n予約日: ${formData.bookingDate}\n利用時間: ${formatDuration(duration)}\n備考: ${formData.notes || 'なし'}`

        const calendarEventResponse = await fetch('/api/calendar/create-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: formData.bookingDate,
            startTime: formData.startTime,
            endTime: endTime,
            title: eventTitle,
            description: eventDescription,
          }),
        })

        if (!calendarEventResponse.ok) {
          console.error('Google Calendar event creation failed:', await calendarEventResponse.text())
          // Googleカレンダーへの追加が失敗しても、予約自体は成功しているので続行
          // ただし、警告を表示
          setError('予約は作成されましたが、Googleカレンダーへの追加に失敗しました。管理者にお問い合わせください。')
        } else {
          const calendarResult = await calendarEventResponse.json()
          // GoogleカレンダーのイベントIDをデータベースに保存（将来的に削除時に使用）
          if (calendarResult.eventId && booking) {
            await supabase
              .from('meeting_room_bookings')
              .update({ google_calendar_event_id: calendarResult.eventId })
              .eq('id', booking.id)
          }
        }
      } catch (calendarErr) {
        console.error('Google Calendar event creation error:', calendarErr)
        // Googleカレンダーへの追加が失敗しても、予約自体は成功しているので続行
      }

      // 成功したらページをリフレッシュ
      router.refresh()
      setFormData({
        bookingDate: '',
        startTime: '',
        durationHours: 1,
        notes: '',
      })
    } catch (err) {
      console.error('Booking error:', err)
      setError('予約の作成中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const amount = calculateAmount()

  // 分ボタンの表示/無効化をbooleanに正規化
  const showMinute0 = availableMinutes?.['0'] !== false
  const showMinute30 = availableMinutes?.['30'] !== false
  const disableMinute0 = checkingAvailability || availableMinutes?.['0'] === false
  const disableMinute30 = checkingAvailability || availableMinutes?.['30'] === false

  // 0分と30分の利用可能性をチェック
  const checkMinuteAvailability = async (date: string, hour: string): Promise<{ '0': boolean; '30': boolean }> => {
    setCheckingAvailability(true)
    const result: { '0': boolean; '30': boolean } = { '0': true, '30': true }

    try {
      // 選択された日付の予約を取得
      const { data: existingBookings, error: checkError } = await supabase
        .from('meeting_room_bookings')
        .select('*')
        .eq('meeting_room_id', meetingRoomId)
        .eq('booking_date', date)
        .in('status', ['reserved', 'confirmed', 'in_use'])

      if (checkError) {
        console.error('Availability check error:', checkError)
        return result // エラー時は両方とも利用可能として扱う
      }

      // Googleカレンダーのイベントを取得
      const dayStart = new Date(`${date}T00:00:00+09:00`)
      const dayEnd = new Date(`${date}T23:59:59+09:00`)
      
      const { data: calendarEvents, error: calendarError } = await supabase
        .from('google_calendar_events_cache')
        .select('*')
        .gte('start_time', dayStart.toISOString())
        .lte('end_time', dayEnd.toISOString())

      if (calendarError) {
        console.error('Googleカレンダーイベント取得エラー:', calendarError)
      }

      // 0分と30分の両方をチェック
      for (const minutes of [0, 30] as const) {
        const startTime = `${hour}:${String(minutes).padStart(2, '0')}`
        const endTime = calculateEndTime(startTime, formData.durationHours)

        // 営業時間終了（22:00）を超える場合は不可
        if (endTime > BUSINESS_CLOSE_TIME) {
          result[String(minutes) as '0' | '30'] = false
          continue
        }

        // データベースの予約と重複チェック
        if (existingBookings) {
          const hasOverlap = existingBookings.some((booking) => {
            const bookingStart = booking.start_time
            const bookingEnd = booking.end_time
            return startTime < bookingEnd && endTime > bookingStart
          })

          if (hasOverlap) {
            result[String(minutes) as '0' | '30'] = false
            continue
          }
        }

        // Googleカレンダーのイベントと重複チェック
        if (calendarEvents) {
          const hasOverlap = calendarEvents.some((event: any) => {
            const eventStart = new Date(event.start_time)
            const eventEnd = new Date(event.end_time)
            const requestStart = new Date(`${date}T${startTime}:00+09:00`)
            const requestEnd = new Date(`${date}T${endTime}:00+09:00`)

            return requestStart.getTime() < eventEnd.getTime() && requestEnd.getTime() > eventStart.getTime()
          })

          if (hasOverlap) {
            result[String(minutes) as '0' | '30'] = false
          }
        }
      }
    } catch (err) {
      console.error('Minute availability check error:', err)
    } finally {
      setCheckingAvailability(false)
    }

    return result
  }

  // カレンダーで日時を選択されたときのハンドラー
  const handleSlotSelect = async (date: string, startTime: string) => {
    // 時間部分を抽出（例: "10:00" → "10"）
    const hour = startTime.split(':')[0]
    setSelectedHour(hour)
    setSelectedMinute(null) // 新しい時間を選択したら分の選択をリセット
    setFormData({
      ...formData,
      bookingDate: date,
      startTime: '', // まだ完全な時刻は設定しない（0分か30分を選択させる）
    })
    setMaxAvailableDuration(null) // 日付・時間が変更されたら最大時間もリセット
    
    // 0分と30分の利用可能性をチェック
    const availability = await checkMinuteAvailability(date, hour)
    setAvailableMinutes(availability)
  }

  // 選択された開始時刻から利用可能な最大時間を計算
  const calculateMaxAvailableDuration = async (date: string, startTime: string): Promise<number> => {
    try {
      // 営業時間終了（22:00）から逆算して最大時間を計算
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [closeHour, closeMin] = BUSINESS_CLOSE_TIME.split(':').map(Number)
      
      const startMinutes = startHour * 60 + startMin
      const closeMinutes = closeHour * 60 + closeMin
      const maxDurationFromCloseTime = (closeMinutes - startMinutes) / 60 // 時間単位

      // 既存予約の開始時刻を取得
      const { data: existingBookings, error: checkError } = await supabase
        .from('meeting_room_bookings')
        .select('start_time')
        .eq('meeting_room_id', meetingRoomId)
        .eq('booking_date', date)
        .in('status', ['reserved', 'confirmed', 'in_use'])
        .gt('start_time', startTime) // 開始時刻より後の予約のみ
        .order('start_time', { ascending: true })
        .limit(1)

      // Googleカレンダーのイベントも取得
      const dayStart = new Date(`${date}T00:00:00+09:00`)
      const dayEnd = new Date(`${date}T23:59:59+09:00`)
      
      const { data: calendarEvents, error: calendarError } = await supabase
        .from('google_calendar_events_cache')
        .select('start_time')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .order('start_time', { ascending: true })

      let maxDurationFromBookings = 6 // デフォルトは最大6時間

      // 最も近い予約の開始時刻をチェック
      const nextBookingStart = existingBookings?.[0]?.start_time
      if (nextBookingStart) {
        const [nextHour, nextMin] = nextBookingStart.split(':').map(Number)
        const nextMinutes = nextHour * 60 + nextMin
        maxDurationFromBookings = (nextMinutes - startMinutes) / 60
      }

      // Googleカレンダーのイベントもチェック
      if (calendarEvents && calendarEvents.length > 0) {
        for (const event of calendarEvents) {
          // ISO文字列から時刻部分を抽出（例: "2024-01-01T15:00:00+09:00" → "15:00"）
          const eventStartISO = event.start_time
          const eventStartMatch = eventStartISO.match(/T(\d{2}):(\d{2})/)
          if (eventStartMatch) {
            const [, eventHourStr, eventMinStr] = eventStartMatch
            const eventHour = parseInt(eventHourStr, 10)
            const eventMin = parseInt(eventMinStr, 10)
            const eventMinutes = eventHour * 60 + eventMin
            
            if (eventMinutes > startMinutes) {
              const durationFromEvent = (eventMinutes - startMinutes) / 60
              maxDurationFromBookings = Math.min(maxDurationFromBookings, durationFromEvent)
              break // 最初のイベントが最も近い
            }
          }
        }
      }

      // 営業時間終了と既存予約の開始時刻の両方を考慮して最小値を返す
      return Math.min(maxDurationFromCloseTime, maxDurationFromBookings)
    } catch (err) {
      console.error('Max duration calculation error:', err)
      return 6 // エラー時は最大6時間を返す
    }
  }

  // 開始時刻の分を選択（0分または30分）
  const handleMinuteSelect = async (minutes: number) => {
    if (!selectedHour || !formData.bookingDate) return
    
    const startTime = `${selectedHour}:${String(minutes).padStart(2, '0')}`
    
    // 利用可能な最大時間を計算
    const maxDuration = await calculateMaxAvailableDuration(formData.bookingDate, startTime)
    setMaxAvailableDuration(maxDuration)
    
    // 現在の利用時間が最大時間を超えている場合は調整
    const adjustedDuration = Math.min(formData.durationHours, maxDuration)
    
    setFormData({
      ...formData,
      startTime: startTime,
      durationHours: adjustedDuration,
    })
    setSelectedMinute(minutes) // 選択された分を保存（ボタンのアクティブ表示用）
    // setSelectedHour(null) は削除：ボタンを表示し続けるため
    // setAvailableMinutes(null) は削除：利用可能性の状態を保持するため
  }

  return (
    <>
      {/* 確認モーダル */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-room-charcoal mb-4">
              予約内容の確認
            </h3>
            
            {/* 予約内容 */}
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-room-charcoal-light">予約日</span>
                <span className="text-room-charcoal font-medium">
                  {new Date(formData.bookingDate).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-room-charcoal-light">開始時刻</span>
                <span className="text-room-charcoal font-medium">{formData.startTime}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-room-charcoal-light">利用時間</span>
                <span className="text-room-charcoal font-medium">
                  {formatDuration(formData.durationHours)}
                </span>
              </div>
              {endTime && (
                <div className="flex justify-between text-sm">
                  <span className="text-room-charcoal-light">終了時刻</span>
                  <span className="text-room-charcoal font-medium">{endTime}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t border-room-base-dark">
                <span className="text-room-charcoal-light">予定料金</span>
                <span className="text-lg font-bold text-room-wood">
                  ¥{amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* キャンセルポリシー */}
            <div className="mb-6 p-4 bg-room-base-light rounded-md border border-room-base-dark">
              <h4 className="text-sm font-medium text-room-charcoal mb-2">
                キャンセルポリシー
              </h4>
              {memberType === 'regular' ? (
                // 会員向けのキャンセルポリシー
                <ul className="text-xs text-room-charcoal-light space-y-1">
                  <li>• 予約日の前日24時（日付が変わるまで）：キャンセル料無料（決済手数料も発生しません）</li>
                  <li>• 当日キャンセル：返金なし</li>
                  {planInfo?.features?.type === 'shared_office' && freeHours && freeHours > 0 && (
                    <>
                      <li className="mt-2 pt-2 border-t border-room-base-dark">
                        <span className="text-room-main font-medium">※ シェアオフィスプラン（無料枠あり）</span>
                      </li>
                      <li>• 前日24時までキャンセル：無料枠が戻ります</li>
                      <li>• 当日キャンセル：無料枠を消費します</li>
                    </>
                  )}
                  <li className="mt-2 pt-2 border-t border-room-base-dark">
                    <span className="text-room-main font-medium">※ 会員様</span>：ひと月まとめて決済のため、前日までキャンセルは決済手数料もかかりません
                  </li>
                </ul>
              ) : (
                // 非会員（ドロップイン会員・ゲスト）向けのキャンセルポリシー
                <ul className="text-xs text-room-charcoal-light space-y-1">
                  <li>• 予約日の前日24時（日付が変わるまで）：キャンセル料無料（決済手数料3.6%+40円のみ差し引きます）</li>
                  <li>• 当日キャンセル：返金なし（100%）</li>
                  <li className="mt-2 pt-2 border-t border-room-base-dark">
                    <span className="text-room-main font-medium">※ 非会員様</span>：予約時に決済を行います。前日までキャンセルの場合、決済手数料のみ差し引いて返金されます
                  </li>
                </ul>
              )}
            </div>

            {/* 注意事項 */}
            <div className="mb-6 p-4 bg-room-wood bg-opacity-10 rounded-md border border-room-wood">
              {memberType === 'regular' ? (
                <div className="space-y-2 text-xs text-room-charcoal-light">
                  <p>※ 予約を確定すると、上記のキャンセルポリシーが適用されます。</p>
                  <p>※ 会員様は、予約料金は月末にまとめて請求されます。</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-room-charcoal-light">
                  <p>※ 予約を確定すると、上記のキャンセルポリシーが適用されます。</p>
                  <p>※ 非会員様は、予約時に決済を行います。前日までキャンセルの場合、決済手数料（3.6%+40円）を差し引いた金額が返金されます。</p>
                </div>
              )}
            </div>

            {/* 非会員で決済が必要な場合：決済フォームを表示 */}
            {(() => {
              const shouldShowPaymentForm = clientSecret && memberType !== 'regular' && amount > 0
              console.log('Payment form display check:', {
                clientSecret: !!clientSecret,
                clientSecretValue: clientSecret,
                memberType,
                amount,
                shouldShowPaymentForm,
                pendingBookingId: pendingBooking?.id,
                showConfirmModal
              })
              return shouldShowPaymentForm
            })() ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  clientSecret={clientSecret}
                  paymentIntentId={paymentIntentId}
                  bookingId={pendingBooking?.id}
                  amount={amount}
                  onSuccess={() => {
                    setShowConfirmModal(false)
                    setClientSecret(null)
                    setPaymentIntentId(null)
                    setPendingBooking(null)
                    router.refresh()
                  }}
                  onError={(errorMessage) => {
                    setError(errorMessage)
                  }}
                />
              </Elements>
            ) : (
              /* ボタン */
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false)
                    setClientSecret(null)
                    setPaymentIntentId(null)
                    setPendingBooking(null)
                  }}
                  disabled={loading}
                  className="px-4 py-2 text-sm rounded-md border border-room-base-dark text-room-charcoal hover:bg-room-base disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={loading}
                  className="px-4 py-2 text-sm rounded-md bg-room-main text-white hover:bg-room-main-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '予約中...' : '確定'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
      {/* 空き状況カレンダー */}
      <div className="rounded-lg bg-room-base-light p-4 shadow border border-room-base-dark">
        <h3 className="text-lg font-semibold text-room-charcoal mb-4">
          ご利用開始日時を選択してください
        </h3>
        <AvailabilityCalendar
          meetingRoomId={meetingRoomId}
          minDurationHours={formData.durationHours}
          onSelectSlot={handleSlotSelect}
        />
      </div>

      {/* 予約フォーム */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 予約日 */}
        <div>
          <label htmlFor="bookingDate" className="block text-sm font-medium text-room-charcoal mb-1">
            予約日 <span className="text-room-main-dark">*</span>
          </label>
          <input
            id="bookingDate"
            type="date"
            required
            min={today}
            value={formData.bookingDate}
            onChange={(e) => {
              setFormData({ ...formData, bookingDate: e.target.value, startTime: '' })
              setSelectedHour(null) // 日付が変更されたら選択をリセット
              setSelectedMinute(null) // 日付が変更されたら選択をリセット
              setMaxAvailableDuration(null) // 日付が変更されたら最大時間もリセット
            }}
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {/* 開始時刻 */}
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-room-charcoal mb-1">
            開始時刻 <span className="text-room-main-dark">*</span>
          </label>
          {selectedHour ? (
            // 時間が選択された場合は、0分と30分の2つのボタンを表示（常に両方表示）
            <div className="flex gap-2 mt-1">
              {showMinute0 && (
                <button
                  type="button"
                  onClick={() => handleMinuteSelect(0)}
                  disabled={disableMinute0}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-room-main transition-colors ${
                    disableMinute0
                      ? 'border-room-base-dark bg-room-base-dark text-room-charcoal-light cursor-not-allowed opacity-50'
                      : selectedMinute === 0
                      ? 'border-room-main bg-room-main bg-opacity-20 text-room-main font-medium'
                      : 'border-room-base-dark bg-room-base hover:bg-room-base-dark text-room-charcoal'
                  }`}
                >
                  {checkingAvailability ? '確認中...' : `${selectedHour}:00`}
                </button>
              )}
              {showMinute30 && (
                <button
                  type="button"
                  onClick={() => handleMinuteSelect(30)}
                  disabled={disableMinute30}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-room-main transition-colors ${
                    disableMinute30
                      ? 'border-room-base-dark bg-room-base-dark text-room-charcoal-light cursor-not-allowed opacity-50'
                      : selectedMinute === 30
                      ? 'border-room-main bg-room-main bg-opacity-20 text-room-main font-medium'
                      : 'border-room-base-dark bg-room-base hover:bg-room-base-dark text-room-charcoal'
                  }`}
                >
                  {checkingAvailability ? '確認中...' : `${selectedHour}:30`}
                </button>
              )}
              {availableMinutes?.['0'] === false && availableMinutes?.['30'] === false && (
                <div className="flex-1 rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm text-room-charcoal-light">
                  この時間帯は予約できません
                </div>
              )}
            </div>
          ) : formData.startTime ? (
            // 既に開始時刻が設定されている場合は表示のみ
            <div className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm text-room-charcoal">
              {formData.startTime}
            </div>
          ) : (
            // まだ選択されていない場合は、カレンダーから選択するよう促す
            <div className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm text-room-charcoal-light text-sm">
              上のカレンダーから時刻を選択してください
            </div>
          )}
        </div>

        {/* 利用時間 */}
        <div className="md:col-span-2">
          <label htmlFor="durationHours" className="block text-sm font-medium text-room-charcoal mb-1">
            利用時間 <span className="text-room-main-dark">*</span>
            <span className="text-xs text-room-charcoal-light ml-2">
              （空き状況カレンダーはこの時間でフィルタリングされます）
            </span>
          </label>
          <select
            id="durationHours"
            required
            value={formData.durationHours}
            onChange={(e) => {
              setFormData({ ...formData, durationHours: parseFloat(e.target.value) })
              // 利用時間が変更されたらカレンダーも再読み込みされる（useEffectで自動）
            }}
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          >
            {availableDurationOptions.map((hours) => (
              <option key={hours} value={hours}>
                {formatDuration(hours)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 備考 */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-room-charcoal mb-1">
          備考（任意）
        </label>
        <textarea
          id="notes"
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          placeholder="特記事項があれば記入してください"
        />
      </div>

      {/* 料金表示 */}
      {duration > 0 && formData.startTime && (
        <div className="rounded-md bg-room-wood bg-opacity-10 p-4 border border-room-wood">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-room-charcoal">利用時間</span>
            <span className="text-sm font-medium text-room-charcoal">
              {formatDuration(duration)}
            </span>
          </div>
          {endTime && (
            <div className="flex justify-between items-center mb-2 text-xs text-room-charcoal-light">
              <span>終了時刻</span>
              <span>{endTime}</span>
            </div>
          )}
          {freeHours && freeHours > 0 && (
            <div className="flex justify-between items-center mb-2 text-xs text-room-charcoal-light">
              <span>無料枠（月{freeHours}時間まで）</span>
              <span>使用状況: 確認中...</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-room-wood">
            <span className="text-sm font-medium text-room-charcoal">予定料金</span>
            <span className="text-lg font-bold text-room-wood">
              ¥{amount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={loading || duration <= 0 || !formData.startTime}
        className="w-full rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '予約中...' : '予約する'}
      </button>
    </form>
    </div>
    </>
  )
}

