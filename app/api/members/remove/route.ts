import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeMode } from '@/lib/stripe/mode'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  try {
    const stripeMode = await getStripeMode()
    const stripe = getStripeClient(stripeMode)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const memberPlanId = request.nextUrl.searchParams.get('memberPlanId')
    if (!memberPlanId) {
      return NextResponse.json(
        { error: 'memberPlanIdが必要です' },
        { status: 400 }
      )
    }

    // メンバーのプランを取得（自分が招待したメンバーのみ）
    const { data: memberPlan, error: planError } = await supabase
      .from('user_plans')
      .select('id, user_id, options, invited_by')
      .eq('id', memberPlanId)
      .eq('invited_by', user.id)
      .eq('status', 'active')
      .single()

    if (planError || !memberPlan) {
      return NextResponse.json(
        { error: 'メンバーのプランが見つかりません' },
        { status: 404 }
      )
    }

    // Stripeサブスクリプションアイテムのquantityを減らす（1なら削除）
    const stripeItemId = memberPlan.options?.stripe_subscription_item_id
    if (stripeItemId) {
      try {
        const item = await stripe.subscriptionItems.retrieve(stripeItemId)
        if (item.quantity && item.quantity > 1) {
          await stripe.subscriptionItems.update(stripeItemId, {
            quantity: item.quantity - 1,
            proration_behavior: 'none',
          })
        } else {
          await stripe.subscriptionItems.del(stripeItemId, {
            proration_behavior: 'none',
          })
        }
      } catch (stripeError: any) {
        console.error('Stripe item update error:', stripeError)
        if (stripeError.code !== 'resource_missing') {
          return NextResponse.json(
            { error: `Stripeアイテムの更新に失敗しました: ${stripeError.message}` },
            { status: 500 }
          )
        }
      }
    }

    // user_plansを終了
    const today = new Date().toISOString().split('T')[0]
    const { error: updateError } = await supabase
      .from('user_plans')
      .update({
        status: 'cancelled',
        ended_at: today,
      })
      .eq('id', memberPlanId)

    if (updateError) {
      console.error('Member plan update error:', updateError)
      return NextResponse.json(
        { error: 'メンバーのプラン終了に失敗しました' },
        { status: 500 }
      )
    }

    // キャッシュクリア
    await Promise.all([
      cache.delete(cacheKey('user_plan', memberPlan.user_id)),
      cache.delete(cacheKey('user_plans_full', memberPlan.user_id)),
      cache.delete(cacheKey('user_full', memberPlan.user_id)),
      cache.delete(cacheKey('user', memberPlan.user_id)),
      cache.delete(cacheKey('user_plan', user.id)),
      cache.delete(cacheKey('user_plans_full', user.id)),
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Member remove error:', error)
    return NextResponse.json(
      { error: error.message || 'メンバー削除に失敗しました' },
      { status: 500 }
    )
  }
}
