import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

/**
 * 座席チェックインAPI
 * 
 * 前提条件:
 * - 会場にチェックインしている必要がある（checkinsテーブルに未チェックアウトのレコードがある）
 * - 座席が空いている必要がある（seat_checkinsテーブルに未チェックアウトのレコードがない）
 * - 会議室座席の場合は、現在時刻に会議室予約がない必要がある
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { seatId } = body

    if (!seatId) {
      return NextResponse.json({ error: 'seatIdが必要です' }, { status: 400 })
    }

    // 1. 座席情報を取得
    const { data: seat, error: seatError } = await supabase
      .from('seats')
      .select('id, seat_number, seat_name, seat_type, status')
      .eq('id', seatId)
      .single()

    if (seatError || !seat) {
      return NextResponse.json({ error: '座席情報が見つかりません' }, { status: 404 })
    }

    // 座席が利用可能かチェック
    if (seat.status !== 'active') {
      return NextResponse.json(
        { error: 'この座席は現在利用できません' },
        { status: 400 }
      )
    }

    // 2. 会場にチェックインしているか確認
    const { data: currentCheckin, error: checkinError } = await supabase
      .from('checkins')
      .select('id')
      .eq('user_id', user.id)
      .is('checkout_at', null)
      .order('checkin_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkinError && checkinError.code !== 'PGRST116') {
      console.error('Checkin check error:', checkinError)
      return NextResponse.json(
        { error: 'チェックイン状態の確認に失敗しました' },
        { status: 500 }
      )
    }

    if (!currentCheckin) {
      return NextResponse.json(
        { error: '会場にチェックインしている必要があります' },
        { status: 400 }
      )
    }

    // 3. 座席が空いているか確認
    const { data: existingSeatCheckin, error: seatCheckinError } = await supabase
      .from('seat_checkins')
      .select('id, user_id')
      .eq('seat_id', seatId)
      .is('checkout_at', null)
      .maybeSingle()

    if (seatCheckinError && seatCheckinError.code !== 'PGRST116') {
      console.error('Seat checkin check error:', seatCheckinError)
      return NextResponse.json(
        { error: '座席の空き状況の確認に失敗しました' },
        { status: 500 }
      )
    }

    if (existingSeatCheckin) {
      // 自分が既にチェックインしている場合はエラー
      if (existingSeatCheckin.user_id === user.id) {
        return NextResponse.json(
          { error: '既にこの座席にチェックインしています' },
          { status: 400 }
        )
      }
      // 他のユーザーが使用中
      return NextResponse.json(
        { error: 'この座席は既に使用されています' },
        { status: 400 }
      )
    }

    // 4. 会議室座席の場合は、現在時刻に会議室予約がないか確認
    if (seat.seat_type === 'meeting_room') {
      const now = new Date()
      const today = now.toISOString().split('T')[0] // YYYY-MM-DD
      const currentTime = now.toTimeString().substring(0, 5) // HH:mm

      // 今日の会議室予約を取得
      const { data: todayBookings, error: bookingsError } = await supabase
        .from('meeting_room_bookings')
        .select('id, start_time, end_time')
        .eq('booking_date', today)
        .in('status', ['reserved', 'confirmed', 'in_use'])

      if (bookingsError) {
        console.error('Meeting room bookings check error:', bookingsError)
        return NextResponse.json(
          { error: '会議室予約の確認に失敗しました' },
          { status: 500 }
        )
      }

      // 現在時刻が予約時間内かチェック
      const hasActiveBooking = todayBookings?.some((booking) => {
        const bookingStart = booking.start_time.substring(0, 5) // HH:mm
        const bookingEnd = booking.end_time.substring(0, 5) // HH:mm
        return currentTime >= bookingStart && currentTime < bookingEnd
      })

      if (hasActiveBooking) {
        return NextResponse.json(
          { error: '会議室が予約されているため、座席を利用できません' },
          { status: 400 }
        )
      }
    }

    // 5. 座席チェックインを作成
    const { data: seatCheckin, error: insertError } = await supabase
      .from('seat_checkins')
      .insert({
        user_id: user.id,
        seat_id: seatId,
        checkin_id: currentCheckin.id,
        checkin_at: new Date().toISOString(),
      })
      .select('id, checkin_at')
      .single()

    if (insertError) {
      console.error('Seat checkin insert error:', insertError)
      // 重複エラーの場合（同時にチェックインしようとした場合）
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '既にこの座席にチェックインしています' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: '座席チェックインに失敗しました' },
        { status: 500 }
      )
    }

    // キャッシュを削除（座席状況が変わったため）
    await Promise.all([
      cache.delete(cacheKey('seat_status', seatId)),
      cache.delete(cacheKey('seats_availability')),
    ])

    return NextResponse.json({
      success: true,
      message: '座席にチェックインしました',
      seatCheckin: {
        id: seatCheckin.id,
        seatNumber: seat.seat_number,
        seatName: seat.seat_name,
        checkinAt: seatCheckin.checkin_at,
      },
    })
  } catch (error: any) {
    console.error('Seat checkin API error:', error)
    return NextResponse.json(
      { error: error.message || '座席チェックインに失敗しました' },
      { status: 500 }
    )
  }
}

