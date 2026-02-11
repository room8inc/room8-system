import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeMode } from '@/lib/stripe/mode'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getPlanPriceId, getCouponId } from '@/lib/stripe/price-config'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { memberPlanId, newPlanId, newPlanType } = body

    if (!memberPlanId || !newPlanId) {
      return NextResponse.json(
        { error: 'memberPlanIdとnewPlanIdが必要です' },
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

    // メイン会員のプランを確認（価格上限チェック用）
    const { data: hostPlan } = await supabase
      .from('user_plans')
      .select('plan_id, plan_type, plans:plan_id(workspace_price, shared_office_price)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .is('invited_by', null)
      .maybeSingle()

    // 新しいプラン情報を取得
    const { data: newPlan, error: newPlanError } = await supabase
      .from('plans')
      .select('id, code, name, workspace_price, shared_office_price, is_active')
      .eq('id', newPlanId)
      .eq('is_active', true)
      .single()

    if (newPlanError || !newPlan) {
      return NextResponse.json(
        { error: '変更先プランが見つかりません' },
        { status: 404 }
      )
    }

    // メンバーのプラン価格 ≤ メイン会員のプラン価格を検証
    if (hostPlan) {
      const hostPlanData = Array.isArray(hostPlan.plans) ? hostPlan.plans[0] : hostPlan.plans
      const hostPrice = hostPlan.plan_type === 'shared_office'
        ? hostPlanData?.shared_office_price
        : hostPlanData?.workspace_price
      const effectiveType = newPlanType || 'workspace'
      const newPrice = effectiveType === 'shared_office'
        ? newPlan.shared_office_price
        : newPlan.workspace_price

      if (hostPrice && newPrice && newPrice > hostPrice) {
        return NextResponse.json(
          { error: 'メンバーのプランはメイン会員のプラン以下である必要があります' },
          { status: 400 }
        )
      }
    }

    // Stripeサブスクリプションアイテムのプラン変更
    // 旧Priceのquantityを減らし、新Priceのquantityを増やす
    const stripeItemId = memberPlan.options?.stripe_subscription_item_id
    const oldPriceId = memberPlan.options?.stripe_price_id
    const newPriceId = getPlanPriceId(newPlan.code, 'monthly', stripeMode)

    if (!newPriceId) {
      return NextResponse.json(
        { error: 'Stripe価格IDが見つかりません' },
        { status: 500 }
      )
    }

    let newStripeItemId = stripeItemId
    if (stripeItemId && hostPlan) {
      try {
        // メイン会員のサブスクリプションを取得
        const hostPlanData2 = await supabase
          .from('user_plans')
          .select('stripe_subscription_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('ended_at', null)
          .is('invited_by', null)
          .single()

        const subscriptionId = hostPlanData2.data?.stripe_subscription_id
        if (subscriptionId) {
          // 旧アイテムのquantityを減らす
          const oldItem = await stripe.subscriptionItems.retrieve(stripeItemId)
          if (oldItem.quantity && oldItem.quantity > 1) {
            await stripe.subscriptionItems.update(stripeItemId, {
              quantity: oldItem.quantity - 1,
              proration_behavior: 'none',
            })
          } else {
            await stripe.subscriptionItems.del(stripeItemId, {
              proration_behavior: 'none',
            })
          }

          // 新Priceのアイテムを追加（既存があればquantity増加）
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const existingNewItem = subscription.items.data.find(
            (item) => item.price.id === newPriceId
          )

          if (existingNewItem) {
            await stripe.subscriptionItems.update(existingNewItem.id, {
              quantity: (existingNewItem.quantity || 1) + 1,
              proration_behavior: 'none',
            })
            newStripeItemId = existingNewItem.id
          } else {
            const couponId = getCouponId('group_second_slot', stripeMode)
            const itemParams: any = {
              subscription: subscriptionId,
              price: newPriceId,
              metadata: { type: 'invited_member' },
            }
            if (couponId) {
              itemParams.discounts = [{ coupon: couponId }]
            }
            const created = await stripe.subscriptionItems.create(itemParams)
            newStripeItemId = created.id
          }
        }
      } catch (stripeError: any) {
        console.error('Stripe item update error:', stripeError)
        return NextResponse.json(
          { error: `Stripeプラン変更に失敗しました: ${stripeError.message}` },
          { status: 500 }
        )
      }
    }

    // user_plansを更新（Stripeアイテム情報も更新）
    const updatedOptions = {
      ...memberPlan.options,
      stripe_subscription_item_id: newStripeItemId,
      stripe_price_id: newPriceId,
    }
    const updateData: Record<string, any> = {
      plan_id: newPlanId,
      options: updatedOptions,
    }
    if (newPlanType) {
      updateData.plan_type = newPlanType
    }

    const { error: updateError } = await supabase
      .from('user_plans')
      .update(updateData)
      .eq('id', memberPlanId)

    if (updateError) {
      console.error('Member plan update error:', updateError)
      return NextResponse.json(
        { error: 'メンバーのプラン更新に失敗しました' },
        { status: 500 }
      )
    }

    // キャッシュクリア
    await Promise.all([
      cache.delete(cacheKey('user_plan', memberPlan.user_id)),
      cache.delete(cacheKey('user_plans_full', memberPlan.user_id)),
      cache.delete(cacheKey('user_full', memberPlan.user_id)),
      cache.delete(cacheKey('user', memberPlan.user_id)),
    ])

    return NextResponse.json({
      success: true,
      newPlanName: newPlan.name,
    })
  } catch (error: any) {
    console.error('Member change-plan error:', error)
    return NextResponse.json(
      { error: error.message || 'メンバーのプラン変更に失敗しました' },
      { status: 500 }
    )
  }
}
