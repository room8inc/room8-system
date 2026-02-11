import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 自分が招待したアクティブなメンバーのプランを取得
    const { data: members, error } = await supabase
      .from('user_plans')
      .select(`
        id,
        plan_id,
        plan_type,
        started_at,
        status,
        discount_code,
        options,
        users:user_id(id, name, email),
        plans:plan_id(id, name, code, workspace_price, shared_office_price)
      `)
      .eq('invited_by', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .order('started_at', { ascending: true })

    if (error) {
      console.error('Member list query error:', error)
      return NextResponse.json(
        { error: 'メンバー一覧の取得に失敗しました' },
        { status: 500 }
      )
    }

    // レスポンス用に整形
    const formattedMembers = (members || []).map((m: any) => {
      const planData = Array.isArray(m.plans) ? m.plans[0] : m.plans
      const userData = Array.isArray(m.users) ? m.users[0] : m.users
      const price = m.plan_type === 'shared_office'
        ? planData?.shared_office_price
        : planData?.workspace_price
      const discountedPrice = m.discount_code === 'group_50off'
        ? Math.floor((price || 0) / 2)
        : price

      return {
        id: m.id,
        userName: userData?.name || '不明',
        email: userData?.email || '',
        planName: planData?.name || '不明',
        planType: m.plan_type,
        monthlyPrice: price || 0,
        discountedPrice: discountedPrice || 0,
        discountCode: m.discount_code,
        startedAt: m.started_at,
        stripeSubscriptionItemId: m.options?.stripe_subscription_item_id || null,
      }
    })

    return NextResponse.json({
      members: formattedMembers,
      totalMonthly: formattedMembers.reduce((sum: number, m: any) => sum + m.discountedPrice, 0),
    })
  } catch (error: any) {
    console.error('Member list error:', error)
    return NextResponse.json(
      { error: error.message || 'メンバー一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}
