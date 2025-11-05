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

  // 週を移動
  const moveWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeekStart(newDate)
  }

  // 日付を文字列に変換（YYYY-MM-DD）
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  // 日付の表示用フォーマット
  const formatDateDisplay = (date: Date): string => {
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

          // 指定された利用時間で終了時刻を計算
          const [startHours, startMins] = timeSlot.split(':').map(Number)
          const endMinutes = startHours * 60 + startMins + minDurationHours * 60
          const endHours = Math.floor(endMinutes / 60) % 24
          const endMins = endMinutes % 60
          const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`

          // データベース内の予約と重複チェック
          const hasOverlap = existingBookings?.some((booking) => {
            if (booking.booking_date !== dateStr) return false
            const bookingStart = booking.start_time
            const bookingEnd = booking.end_time
            return timeSlot < bookingEnd && endTime > bookingStart
          })

          if (hasOverlap) {
            availabilityMap.set(key, {
              date: dateStr,
              timeSlot,
              available: false,
              reason: '既に予約済み',
            })
            continue
          }

          // Googleカレンダーをチェック（非同期で実行）
          availabilityMap.set(key, {
            date: dateStr,
            timeSlot,
            available: true, // まずはtrueとして設定、後でGoogleカレンダーで確認
          })
        }
      }

      // Googleカレンダーのチェック（バッチ処理）
      const checkPromises: Promise<void>[] = []
      availabilityMap.forEach((status, key) => {
        if (status.available) {
          checkPromises.push(
            fetch('/api/calendar/check-availability', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                date: status.date,
                startTime: status.timeSlot,
                endTime: (() => {
                  const [hours, mins] = status.timeSlot.split(':').map(Number)
                  const endMinutes = hours * 60 + mins + minDurationHours * 60
                  const endHours = Math.floor(endMinutes / 60) % 24
                  const endMins = endMinutes % 60
                  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
                })(),
              }),
            })
              .then(async (res) => {
                if (res.ok) {
                  const result = await res.json()
                  if (!result.available) {
                    availabilityMap.set(key, {
                      ...status,
                      available: false,
                      reason: result.reason || '予約不可',
                    })
                  }
                } else {
                  // Googleカレンダーのチェックが失敗した場合は安全側に倒す
                  availabilityMap.set(key, {
                    ...status,
                    available: false,
                    reason: '確認中...',
                  })
                }
              })
              .catch(() => {
                // エラー時は安全側に倒す
                availabilityMap.set(key, {
                  ...status,
                  available: false,
                  reason: '確認中...',
                })
              })
          )
        }
      })

      // すべてのGoogleカレンダーチェックが完了するまで待機
      await Promise.all(checkPromises)

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
                          : isAvailable
                          ? 'bg-white hover:bg-room-base cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={status?.reason || ''}
                    >
                      {isAvailable ? '○' : '×'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-4 text-xs text-room-charcoal-light">
        <span>○ 予約可能な時間があります</span>
        <span>× 予約できません</span>
      </div>

      {loading && (
        <div className="text-center text-sm text-room-charcoal-light py-4">
          空き状況を確認中...
        </div>
      )}
    </div>
  )
}

