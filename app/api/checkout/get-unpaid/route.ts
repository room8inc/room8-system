import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 未決済のチェックアウト一覧を取得
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

    // 未決済のチェックアウトを取得
    // 古い決済方式のデータ（stripe_payment_intent_idがあるがdropin_feeがnull）は除外
    const { data: unpaidCheckouts, error } = await supabase
      .from('checkins')
      .select('id, checkin_at, checkout_at, duration_minutes, dropin_fee, payment_status, stripe_payment_intent_id')
      .eq('user_id', user.id)
      .eq('member_type_at_checkin', 'dropin')
      .not('checkout_at', 'is', null)
      .eq('payment_status', 'pending')
      .order('checkout_at', { ascending: false })

    // 古い決済方式のデータを除外（stripe_payment_intent_idがあるがdropin_feeがnullのもの）
    // これらは新しい決済方式では処理できないため、除外する
    const validUnpaidCheckouts = unpaidCheckouts?.filter(checkout => {
      // 古い決済方式のデータを除外
      if (checkout.stripe_payment_intent_id && checkout.dropin_fee === null) {
        return false
      }
      // dropin_feeがnullでduration_minutesもnullのものは除外（データ不整合）
      if (checkout.dropin_fee === null && checkout.duration_minutes === null) {
        return false
      }
      return true
    }) || []

    if (error) {
      return NextResponse.json({ error: '未決済情報の取得に失敗しました' }, { status: 500 })
    }

    // 合計金額を計算
    const totalAmount = validUnpaidCheckouts.reduce((sum, checkout) => sum + (checkout.dropin_fee || 0), 0)

    return NextResponse.json({
      unpaidCheckouts: validUnpaidCheckouts,
      totalAmount,
      count: validUnpaidCheckouts.length,
    })
  } catch (error: any) {
    console.error('Get unpaid checkouts error:', error)
    return NextResponse.json(
      { error: error.message || '未決済情報の取得に失敗しました' },
      { status: 500 }
    )
  }
}

