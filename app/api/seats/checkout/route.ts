import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

/**
 * 座席チェックアウトAPI
 * 
 * 自分の座席をチェックアウトする
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

    // 1. 自分の座席チェックインを取得
    const { data: seatCheckin, error: checkinError } = await supabase
      .from('seat_checkins')
      .select('id, seat_id, checkin_at')
      .eq('user_id', user.id)
      .eq('seat_id', seatId)
      .is('checkout_at', null)
      .order('checkin_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkinError && checkinError.code !== 'PGRST116') {
      console.error('Seat checkin fetch error:', checkinError)
      return NextResponse.json(
        { error: '座席チェックイン情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    if (!seatCheckin) {
      return NextResponse.json(
        { error: 'この座席にチェックインしていません' },
        { status: 400 }
      )
    }

    // 2. 座席情報を取得
    const { data: seat, error: seatError } = await supabase
      .from('seats')
      .select('seat_number, seat_name')
      .eq('id', seatId)
      .single()

    if (seatError || !seat) {
      console.warn('Seat info fetch error (non-blocking):', seatError)
    }

    // 3. 座席チェックアウトを実行
    const checkoutAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('seat_checkins')
      .update({
        checkout_at: checkoutAt,
      })
      .eq('id', seatCheckin.id)

    if (updateError) {
      console.error('Seat checkout update error:', updateError)
      return NextResponse.json(
        { error: '座席チェックアウトに失敗しました' },
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
      message: '座席からチェックアウトしました',
      seatCheckout: {
        seatNumber: seat?.seat_number || '不明',
        seatName: seat?.seat_name || '不明',
        checkoutAt,
      },
    })
  } catch (error: any) {
    console.error('Seat checkout API error:', error)
    return NextResponse.json(
      { error: error.message || '座席チェックアウトに失敗しました' },
      { status: 500 }
    )
  }
}

