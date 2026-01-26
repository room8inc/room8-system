'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AvailabilityCalendarProps {
  meetingRoomId: string
  minDurationHours: number
  onSelectSlot: (date: string, startTime: string) => void
}

interface AvailabilityStatus {
  date: string
  timeSlot: string
  available: boolean
  partial?: boolean
  availableMinutes?: { '0': boolean; '30': boolean }
  reason?: string
}

export function AvailabilityCalendar({
  meetingRoomId,
  minDurationHours,
  onSelectSlot,
}: AvailabilityCalendarProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // 今日を含む週の月曜日を取得
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // 月曜日を基準
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const [availability, setAvailability] = useState<Map<string, AvailabilityStatus>>(new Map())
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')

  // 時間帯のリスト（9:00 ~ 21:00、1時間刻み）
  const timeSlots = Array.from({ length: 13 }, (_, i) => {
    const hour = 9 + i
    return `${String(hour).padStart(2, '0')}:00`
  })

  // 週の日付リストを生成
  const getWeekDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()
  const BUSINESS_CLOSE_TIME = '22:00'
  const businessCloseMinutes = Number(BUSINESS_CLOSE_TIME.split(':')[0]) * 60 + Number(BUSINESS_CLOSE_TIME.split(':')[1])

  const normalizeTime = (time: string) => (time.length >= 5 ? time.slice(0, 5) : time)
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = normalizeTime(time).split(':').map(Number)
    return hours * 60 + minutes
  }
  const minutesToTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  // 週を移動
  const moveWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeekStart(newDate)
  }

  // 日付を文字列に変換（YYYY-MM-DD、日本時間で）
  const formatDate = (date: Date): string => {
    // ローカル時刻（日本時間）で日付を取得
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 日付の表示用フォーマット
  const formatDateDisplay = (date: Date): { text: string; color: string } => {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    const color = weekday === '日' ? 'text-red-600' : weekday === '土' ? 'text-blue-600' : ''
    return { text: `${month}/${day} ${weekday}`, color }
  }

  // 空き状況をチェック
  const checkAvailability = async () => {
    setLoading(true)
    const availabilityMap = new Map<string, AvailabilityStatus>()

    try {
      // 週の日付範囲を取得
      const weekStartDate = formatDate(weekDates[0])
      const weekEndDate = formatDate(weekDates[6])

      // データベースから既存予約を取得
      const { data: existingBookings, error: checkError } = await supabase
        .from('meeting_room_bookings')
        .select('*')
        .eq('meeting_room_id', meetingRoomId)
        .gte('booking_date', weekStartDate)
        .lte('booking_date', weekEndDate)
        .in('status', ['reserved', 'confirmed', 'in_use'])

      if (checkError) {
        console.error('Availability check error:', checkError)
        // エラー時はすべて利用不可として表示
        weekDates.forEach((date) => {
          timeSlots.forEach((timeSlot) => {
            const key = `${formatDate(date)}_${timeSlot}`
            availabilityMap.set(key, {
              date: formatDate(date),
              timeSlot,
              available: false,
              reason: '確認中...',
            })
          })
        })
        setAvailability(availabilityMap)
        setLoading(false)
        return
      }

      // 各日付・時間帯の空き状況をチェック
      for (const date of weekDates) {
        const dateStr = formatDate(date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const isPast = date < today

        for (const timeSlot of timeSlots) {
          const key = `${dateStr}_${timeSlot}`
          
          // 過去の日時は予約不可
          if (isPast) {
            availabilityMap.set(key, {
              date: dateStr,
              timeSlot,
              available: false,
              reason: '過去の日時です',
            })
            continue
          }

          // 今日の場合は現在時刻以降のみ予約可能
          if (dateStr === formatDate(new Date())) {
            const [hours, minutes] = timeSlot.split(':').map(Number)
            const slotTime = new Date()
            slotTime.setHours(hours, minutes, 0, 0)
            if (slotTime < new Date()) {
              availabilityMap.set(key, {
                date: dateStr,
                timeSlot,
                available: false,
                reason: '過去の時間です',
              })
              continue
            }
          }

          const slotMinutes = timeToMinutes(timeSlot)
          const availableMinutes: { '0': boolean; '30': boolean } = { '0': true, '30': true }

          for (const minute of [0, 30] as const) {
            const startMinutes = slotMinutes + minute
            const endMinutes = startMinutes + minDurationHours * 60

            if (endMinutes > businessCloseMinutes) {
              availableMinutes[String(minute) as '0' | '30'] = false
              continue
            }

            // 今日の場合は現在時刻以降のみ予約可能（分単位で判定）
            if (dateStr === formatDate(new Date())) {
              const now = new Date()
              const requestTime = new Date()
              requestTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
              if (requestTime < now) {
                availableMinutes[String(minute) as '0' | '30'] = false
                continue
              }
            }

            const hasOverlap = existingBookings?.some((booking) => {
              if (booking.booking_date !== dateStr) return false
              const bookingStart = timeToMinutes(booking.start_time)
              const bookingEnd = timeToMinutes(booking.end_time)
              return startMinutes < bookingEnd && endMinutes > bookingStart
            })

            if (hasOverlap) {
              availableMinutes[String(minute) as '0' | '30'] = false
            }
          }

          const hasAnyAvailability = availableMinutes['0'] || availableMinutes['30']
          const isPartial = hasAnyAvailability && (availableMinutes['0'] !== availableMinutes['30'])

          availabilityMap.set(key, {
            date: dateStr,
            timeSlot,
            available: hasAnyAvailability,
            partial: isPartial,
            availableMinutes,
            reason: isPartial ? '一部時間のみ予約可能' : hasAnyAvailability ? undefined : '既に予約済み（データベース）',
          })
        }
      }

      // DBからGoogleカレンダーのイベントを取得
      try {
        // 週の開始日時と終了日時を取得
        const weekStartDateTime = new Date(weekDates[0])
        weekStartDateTime.setHours(0, 0, 0, 0)
        const weekEndDateTime = new Date(weekDates[6])
        weekEndDateTime.setHours(23, 59, 59, 999)

        const { data: calendarEvents, error: calendarError } = await supabase
          .from('google_calendar_events_cache')
          .select('*')
          .gte('start_time', weekStartDateTime.toISOString())
          .lte('end_time', weekEndDateTime.toISOString())

        if (calendarError) {
          console.error('Googleカレンダーイベント取得エラー:', calendarError)
          // エラー時は安全側に倒す（すべて予約不可にする）
          availabilityMap.forEach((status, key) => {
            if (status.available) {
              availabilityMap.set(key, {
                ...status,
                available: false,
                reason: 'Googleカレンダーの確認に失敗',
              })
            }
          })
        } else {
          // 各時間帯のGoogleカレンダーイベントとの重複をチェック
          availabilityMap.forEach((status, key) => {
            if (!status.available) return // 既に予約不可の場合はスキップ

            const slotMinutes = timeToMinutes(status.timeSlot)
            const availableMinutes = status.availableMinutes ?? { '0': true, '30': true }

            for (const minute of [0, 30] as const) {
              if (!availableMinutes[String(minute) as '0' | '30']) continue

              const startMinutes = slotMinutes + minute
              const endMinutes = startMinutes + minDurationHours * 60
              const endTime = minutesToTime(endMinutes)
              const startTime = minutesToTime(startMinutes)

              const hasOverlap = calendarEvents?.some((event: any) => {
                if (!event.start_time || !event.end_time) return false

                const eventStart = new Date(event.start_time)
                const eventEnd = new Date(event.end_time)

                const eventDateStr = new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'Asia/Tokyo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                }).format(eventStart)

                if (eventDateStr !== status.date) return false

                const requestStart = new Date(`${status.date}T${startTime}:00+09:00`)
                const requestEnd = new Date(`${status.date}T${endTime}:00+09:00`)
                return requestStart.getTime() < eventEnd.getTime() && requestEnd.getTime() > eventStart.getTime()
              })

              if (hasOverlap) {
                availableMinutes[String(minute) as '0' | '30'] = false
              }
            }

            const hasAnyAvailability = availableMinutes['0'] || availableMinutes['30']
            const isPartial = hasAnyAvailability && (availableMinutes['0'] !== availableMinutes['30'])

            availabilityMap.set(key, {
              ...status,
              available: hasAnyAvailability,
              partial: isPartial,
              availableMinutes,
              reason: isPartial ? '一部時間のみ予約可能' : hasAnyAvailability ? undefined : 'Googleカレンダーに予定あり',
            })
          })
        }
      } catch (err) {
        console.error('Googleカレンダーの取得エラー:', err)
        // エラー時は安全側に倒す
        availabilityMap.forEach((status, key) => {
          if (status.available) {
            availabilityMap.set(key, {
              ...status,
              available: false,
              reason: 'Googleカレンダーの確認エラー',
            })
          }
        })
      }

      setAvailability(availabilityMap)
    } catch (err) {
      console.error('Availability check error:', err)
    } finally {
      setLoading(false)
    }
  }

  // 週または利用時間が変更されたら空き状況を再取得
  useEffect(() => {
    checkAvailability()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart, minDurationHours])

  // セルをクリック
  const handleCellClick = (date: string, timeSlot: string) => {
    const key = `${date}_${timeSlot}`
    const status = availability.get(key)
    
    if (status?.available) {
      setSelectedDate(date)
      setSelectedTime(timeSlot)
      onSelectSlot(date, timeSlot)
    }
  }

  return (
    <div className="space-y-4">
      {/* フィルターとナビゲーション */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-room-charcoal">空き時間</span>
          <span className="text-sm text-room-charcoal-light">
            {minDurationHours === 1 ? '1時間以上' :
             minDurationHours === 1.5 ? '1時間30分以上' :
             minDurationHours === 2 ? '2時間以上' :
             minDurationHours === 2.5 ? '2時間30分以上' :
             minDurationHours === 3 ? '3時間以上' :
             `${minDurationHours}時間以上`}
          </span>
          <span className="text-sm text-room-charcoal-light">で絞り込む</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => moveWeek('prev')}
            className="rounded-md border border-room-base-dark bg-room-base px-3 py-1 text-sm hover:bg-room-base-dark"
          >
            ←
          </button>
          <span className="text-sm text-room-charcoal">
            {weekDates[0].getFullYear()}/{weekDates[0].getMonth() + 1}/{weekDates[0].getDate()}
            ({['日', '月', '火', '水', '木', '金', '土'][weekDates[0].getDay()]}) ~{' '}
            {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
            ({['日', '月', '火', '水', '木', '金', '土'][weekDates[6].getDay()]})
          </span>
          <button
            onClick={() => moveWeek('next')}
            className="rounded-md border border-room-base-dark bg-room-base px-3 py-1 text-sm hover:bg-room-base-dark"
          >
            →
          </button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-room-base-dark bg-room-base-dark p-2 text-xs text-room-charcoal-light">
                時間
              </th>
              {weekDates.map((date) => {
                const { text, color } = formatDateDisplay(date)
                const dateStr = formatDate(date)
                const isSelected = selectedDate === dateStr
                return (
                  <th
                    key={dateStr}
                    className={`border border-room-base-dark bg-room-base-dark p-2 text-xs ${
                      isSelected ? 'bg-room-charcoal text-white' : color || 'text-room-charcoal'
                    }`}
                  >
                    {text}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((timeSlot) => (
              <tr key={timeSlot}>
                <td className="border border-room-base-dark bg-room-base-dark p-2 text-xs text-room-charcoal-light whitespace-nowrap">
                  {timeSlot}~
                </td>
                {weekDates.map((date) => {
                  const dateStr = formatDate(date)
                  const key = `${dateStr}_${timeSlot}`
                  const status = availability.get(key)
                  const isAvailable = status?.available ?? false
                  const isSelected = selectedDate === dateStr && selectedTime === timeSlot

                  return (
                    <td
                      key={key}
                      onClick={() => handleCellClick(dateStr, timeSlot)}
                      className={`border border-room-base-dark p-2 text-center cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-room-main text-white'
                          : status?.partial
                          ? 'bg-room-brass bg-opacity-20 text-room-charcoal hover:bg-room-brass hover:bg-opacity-30 cursor-pointer'
                          : isAvailable
                          ? 'bg-white hover:bg-room-base cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={status?.reason || (isAvailable ? '予約可能' : '予約不可')}
                    >
                      {status?.partial ? '△' : isAvailable ? '○' : '×'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 凡例と説明 */}
      <div className="space-y-2">
        <div className="flex items-center gap-4 text-xs text-room-charcoal-light">
          <span>○ 予約可能</span>
          <span>△ 一部の時間のみ予約可能</span>
          <span>× 予約できません</span>
        </div>
        <div className="text-xs text-room-charcoal-light bg-room-base-dark p-2 rounded">
          <p className="font-medium mb-1">空き状況の判定基準:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>データベース内の既存予約をチェック</li>
            <li>Googleカレンダーの予定をチェック</li>
            <li>過去の日時は予約不可</li>
            <li>選択した利用時間で予約可能かを判定</li>
          </ul>
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-room-charcoal-light py-4">
          空き状況を確認中...
        </div>
      )}
    </div>
  )
}

