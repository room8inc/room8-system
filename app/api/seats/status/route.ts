import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

/**
 * 座席の状態を取得するAPI
 * 
 * 返却データ:
 * - 座席一覧とその状態（空き、使用中、メンテナンス中など）
 * - 会議室座席の場合は、現在時刻に会議室予約があるかチェック
 * - 現在のユーザーがチェックインしている座席情報
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // キャッシュキー
    const cacheKeySeats = cacheKey('seats_status', user.id)

    // キャッシュから取得を試みる（30秒間キャッシュ）
    const cached = await cache.get(cacheKeySeats)
    if (cached) {
      return NextResponse.json(cached)
    }

    // 1. 全座席を取得
    const { data: seats, error: seatsError } = await supabase
      .from('seats')
      .select('id, seat_number, seat_name, seat_type, status')
      .order('seat_type', { ascending: true })
      .order('seat_number', { ascending: true })

    if (seatsError) {
      console.error('Seats fetch error:', seatsError)
      return NextResponse.json(
        { error: '座席情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    // 2. 現在チェックイン中の座席を取得
    const { data: activeSeatCheckins, error: checkinsError } = await supabase
      .from('seat_checkins')
      .select('id, seat_id, user_id, checkin_at, users:user_id(name)')
      .is('checkout_at', null)

    if (checkinsError) {
      console.error('Active seat checkins fetch error:', checkinsError)
      // エラーでも続行（座席情報は表示できる）
    }

    // 3. 会議室座席の場合、現在時刻に会議室予約があるかチェック
    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    const currentTime = now.toTimeString().substring(0, 5) // HH:mm

    const { data: todayBookings, error: bookingsError } = await supabase
      .from('meeting_room_bookings')
      .select('id, start_time, end_time')
      .eq('booking_date', today)
      .in('status', ['reserved', 'confirmed', 'in_use'])

    if (bookingsError) {
      console.error('Meeting room bookings fetch error:', bookingsError)
      // エラーでも続行
    }

    // 現在時刻が予約時間内かチェック
    const hasActiveMeetingRoomBooking = todayBookings?.some((booking) => {
      const bookingStart = booking.start_time.substring(0, 5) // HH:mm
      const bookingEnd = booking.end_time.substring(0, 5) // HH:mm
      return currentTime >= bookingStart && currentTime < bookingEnd
    }) || false

    // 4. 座席の状態を構築
    const seatStatusMap = new Map<string, {
      seatId: string
      seatNumber: string
      seatName: string | null
      seatType: 'free_space' | 'meeting_room'
      status: 'active' | 'maintenance' | 'disabled'
      isAvailable: boolean
      isOccupied: boolean
      occupiedBy?: {
        userId: string
        userName: string | null
        checkinAt: string
      }
      unavailableReason?: string
    }>()

    for (const seat of seats || []) {
      // 座席がメンテナンス中または無効化されている場合
      if (seat.status !== 'active') {
        seatStatusMap.set(seat.id, {
          seatId: seat.id,
          seatNumber: seat.seat_number,
          seatName: seat.seat_name,
          seatType: seat.seat_type as 'free_space' | 'meeting_room',
          status: seat.status as 'active' | 'maintenance' | 'disabled',
          isAvailable: false,
          isOccupied: false,
          unavailableReason: seat.status === 'maintenance' ? 'メンテナンス中' : '利用不可',
        })
        continue
      }

      // 会議室座席の場合、予約があるかチェック
      if (seat.seat_type === 'meeting_room' && hasActiveMeetingRoomBooking) {
        seatStatusMap.set(seat.id, {
          seatId: seat.id,
          seatNumber: seat.seat_number,
          seatName: seat.seat_name,
          seatType: 'meeting_room',
          status: 'active',
          isAvailable: false,
          isOccupied: false,
          unavailableReason: '会議室予約中',
        })
        continue
      }

      // 座席が使用中かチェック
      const activeCheckin = activeSeatCheckins?.find(
        (checkin) => checkin.seat_id === seat.id
      )

      if (activeCheckin) {
        const userName = (activeCheckin.users as { name: string } | null)?.name || null
        seatStatusMap.set(seat.id, {
          seatId: seat.id,
          seatNumber: seat.seat_number,
          seatName: seat.seat_name,
          seatType: seat.seat_type as 'free_space' | 'meeting_room',
          status: 'active',
          isAvailable: false,
          isOccupied: true,
          occupiedBy: {
            userId: activeCheckin.user_id,
            userName,
            checkinAt: activeCheckin.checkin_at,
          },
        })
        continue
      }

      // 空き座席
      seatStatusMap.set(seat.id, {
        seatId: seat.id,
        seatNumber: seat.seat_number,
        seatName: seat.seat_name,
        seatType: seat.seat_type as 'free_space' | 'meeting_room',
        status: 'active',
        isAvailable: true,
        isOccupied: false,
      })
    }

    // 5. 現在のユーザーがチェックインしている座席を取得
    const mySeatCheckin = activeSeatCheckins?.find(
      (checkin) => checkin.user_id === user.id
    )

    const result = {
      seats: Array.from(seatStatusMap.values()),
      mySeat: mySeatCheckin
        ? {
            seatId: mySeatCheckin.seat_id,
            checkinId: mySeatCheckin.id,
            checkinAt: mySeatCheckin.checkin_at,
          }
        : null,
      hasActiveMeetingRoomBooking,
    }

    // キャッシュに保存（30秒間）
    await cache.set(cacheKeySeats, result, 30)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Seat status API error:', error)
    return NextResponse.json(
      { error: error.message || '座席状態の取得に失敗しました' },
      { status: 500 }
    )
  }
}

