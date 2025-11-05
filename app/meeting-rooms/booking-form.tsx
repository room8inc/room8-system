'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AvailabilityCalendar } from './availability-calendar'

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

  const [formData, setFormData] = useState({
    bookingDate: '',
    startTime: '',
    durationHours: 1, // デフォルトは1時間
    notes: '',
  })

  // 選択された時刻（時間のみ、分は未選択）
  const [selectedHour, setSelectedHour] = useState<string | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availableMinutes, setAvailableMinutes] = useState<{ '0': boolean; '30': boolean } | null>(null)

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
    setLoading(true)

    try {
      // バリデーション
      if (!formData.bookingDate || !formData.startTime || !formData.durationHours) {
        setError('日時と利用時間を選択してください')
        setLoading(false)
        return
      }

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
          number_of_participants: null, // 一室貸し切りのため人数は不要
          status: 'reserved',
          member_type_at_booking: memberType,
          plan_id_at_booking: planInfo?.id || null,
          is_shared_office_plan: isSharedOffice,
          hourly_rate: hourlyRate,
          total_amount: actualAmount,
          free_hours_used: actualFreeHoursUsed,
          notes: formData.notes || null,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Booking insert error:', insertError)
        setError(`予約の作成に失敗しました: ${insertError.message}`)
        setLoading(false)
        return
      }

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
    setFormData({
      ...formData,
      bookingDate: date,
      startTime: '', // まだ完全な時刻は設定しない（0分か30分を選択させる）
    })
    
    // 0分と30分の利用可能性をチェック
    const availability = await checkMinuteAvailability(date, hour)
    setAvailableMinutes(availability)
  }

  // 開始時刻の分を選択（0分または30分）
  const handleMinuteSelect = (minutes: number) => {
    if (!selectedHour) return
    
    const startTime = `${selectedHour}:${String(minutes).padStart(2, '0')}`
    setFormData({
      ...formData,
      startTime: startTime,
    })
    setSelectedHour(null) // 選択完了したらリセット
    setAvailableMinutes(null) // 利用可能性の状態もリセット
  }

  return (
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
            onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {/* 開始時刻 */}
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-room-charcoal mb-1">
            開始時刻 <span className="text-room-main-dark">*</span>
          </label>
          {selectedHour ? (
            // 時間が選択された場合は、0分と30分の2つのボタンを表示
            <div className="flex gap-2 mt-1">
              {availableMinutes?.['0'] !== false && (
                <button
                  type="button"
                  onClick={() => handleMinuteSelect(0)}
                  disabled={checkingAvailability || Boolean(availableMinutes && availableMinutes['0'] === false)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-room-main ${
                    !!availableMinutes && availableMinutes['0'] === false
                      ? 'border-room-base-dark bg-room-base-dark text-room-charcoal-light cursor-not-allowed opacity-50'
                      : 'border-room-base-dark bg-room-base hover:bg-room-base-dark text-room-charcoal'
                  }`}
                >
                  {checkingAvailability ? '確認中...' : `${selectedHour}:00`}
                </button>
              )}
              {availableMinutes?.['30'] !== false && (
                <button
                  type="button"
                  onClick={() => handleMinuteSelect(30)}
                  disabled={checkingAvailability || Boolean(availableMinutes && availableMinutes['30'] === false)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-room-main ${
                    !!availableMinutes && availableMinutes['30'] === false
                      ? 'border-room-base-dark bg-room-base-dark text-room-charcoal-light cursor-not-allowed opacity-50'
                      : 'border-room-base-dark bg-room-base hover:bg-room-base-dark text-room-charcoal'
                  }`}
                >
                  {checkingAvailability ? '確認中...' : `${selectedHour}:30`}
                </button>
              )}
              {!!availableMinutes && availableMinutes['0'] === false && availableMinutes['30'] === false && (
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
            {durationOptions.map((hours) => (
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
  )
}

