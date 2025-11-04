'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
}

export function BookingForm({
  userId,
  memberType,
  planInfo,
  hourlyRate,
  freeHours,
  meetingRoomId,
}: BookingFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    bookingDate: '',
    startTime: '',
    endTime: '',
    numberOfParticipants: 1,
    notes: '',
  })

  // 今日以降の日付のみ選択可能
  const today = new Date().toISOString().split('T')[0]

  const calculateDuration = () => {
    if (!formData.startTime || !formData.endTime) return 0
    const start = new Date(`2000-01-01T${formData.startTime}`)
    const end = new Date(`2000-01-01T${formData.endTime}`)
    const diffMs = end.getTime() - start.getTime()
    return Math.max(0, diffMs / (1000 * 60 * 60)) // 時間単位
  }

  const calculateAmount = () => {
    const duration = calculateDuration()
    if (duration <= 0) return 0

    // シェアオフィスプランの場合、無料枠を考慮（後で実装）
    // 今は簡易版として、全時間を有料として計算
    const totalAmount = duration * hourlyRate
    return Math.ceil(totalAmount)
  }

  const checkAvailability = async () => {
    if (!formData.bookingDate || !formData.startTime || !formData.endTime) {
      return { available: false, reason: '日時が選択されていません' }
    }

    try {
      // 時間の重複チェック: (start_time < end_time) AND (end_time > start_time)
      // 既存の予約と時間が重複していないかチェック
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
        const requestEnd = formData.endTime

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
      if (!formData.bookingDate || !formData.startTime || !formData.endTime) {
        setError('日時を選択してください')
        setLoading(false)
        return
      }

      const duration = calculateDuration()
      if (duration <= 0) {
        setError('終了時刻は開始時刻より後である必要があります')
        setLoading(false)
        return
      }

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
      let freeHoursUsed = 0
      if (isSharedOffice && freeHours) {
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        const { data: monthlyBookings } = await supabase
          .from('meeting_room_bookings')
          .select('free_hours_used, duration_hours')
          .eq('user_id', userId)
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
          user_id: userId,
          booking_date: formData.bookingDate,
          start_time: formData.startTime,
          end_time: formData.endTime,
          duration_hours: duration,
          number_of_participants: formData.numberOfParticipants,
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

      // 成功したらページをリフレッシュ
      router.refresh()
      setFormData({
        bookingDate: '',
        startTime: '',
        endTime: '',
        numberOfParticipants: 1,
        notes: '',
      })
    } catch (err) {
      console.error('Booking error:', err)
      setError('予約の作成中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const duration = calculateDuration()
  const amount = calculateAmount()

  return (
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

        {/* 人数 */}
        <div>
          <label htmlFor="numberOfParticipants" className="block text-sm font-medium text-room-charcoal mb-1">
            利用人数 <span className="text-room-main-dark">*</span>
          </label>
          <input
            id="numberOfParticipants"
            type="number"
            required
            min={1}
            max={10}
            value={formData.numberOfParticipants}
            onChange={(e) => setFormData({ ...formData, numberOfParticipants: parseInt(e.target.value) || 1 })}
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {/* 開始時刻 */}
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-room-charcoal mb-1">
            開始時刻 <span className="text-room-main-dark">*</span>
          </label>
          <input
            id="startTime"
            type="time"
            required
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {/* 終了時刻 */}
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-room-charcoal mb-1">
            終了時刻 <span className="text-room-main-dark">*</span>
          </label>
          <input
            id="endTime"
            type="time"
            required
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
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
      {duration > 0 && (
        <div className="rounded-md bg-room-wood bg-opacity-10 p-4 border border-room-wood">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-room-charcoal">利用時間</span>
            <span className="text-sm font-medium text-room-charcoal">
              {Math.floor(duration)}時間{Math.round((duration % 1) * 60)}分
            </span>
          </div>
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
        disabled={loading || duration <= 0}
        className="w-full rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '予約中...' : '予約する'}
      </button>
    </form>
  )
}

