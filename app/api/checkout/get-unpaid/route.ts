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
    const { data: unpaidCheckouts, error } = await supabase
      .from('checkins')
      .select('id, checkin_at, checkout_at, duration_minutes, dropin_fee, payment_status')
      .eq('user_id', user.id)
      .eq('member_type_at_checkin', 'dropin')
      .not('checkout_at', 'is', null)
      .eq('payment_status', 'pending')
      .order('checkout_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: '未決済情報の取得に失敗しました' }, { status: 500 })
    }

    // 合計金額を計算
    const totalAmount = unpaidCheckouts?.reduce((sum, checkout) => sum + (checkout.dropin_fee || 0), 0) || 0

    return NextResponse.json({
      unpaidCheckouts: unpaidCheckouts || [],
      totalAmount,
      count: unpaidCheckouts?.length || 0,
    })
  } catch (error: any) {
    console.error('Get unpaid checkouts error:', error)
    return NextResponse.json(
      { error: error.message || '未決済情報の取得に失敗しました' },
      { status: 500 }
    )
  }
}

