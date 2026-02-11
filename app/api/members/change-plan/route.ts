import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeMode } from '@/lib/stripe/mode'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getPlanPriceId } from '@/lib/stripe/price-config'
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

    // Stripeサブスクリプションアイテムの価格を変更
    const stripeItemId = memberPlan.options?.stripe_subscription_item_id
    if (stripeItemId) {
      const newPriceId = getPlanPriceId(newPlan.code, 'monthly', stripeMode)
      if (!newPriceId) {
        return NextResponse.json(
          { error: 'Stripe価格IDが見つかりません' },
          { status: 500 }
        )
      }

      try {
        await stripe.subscriptionItems.update(stripeItemId, {
          price: newPriceId,
          proration_behavior: 'none',
        })
      } catch (stripeError: any) {
        console.error('Stripe item update error:', stripeError)
        return NextResponse.json(
          { error: `Stripeプラン変更に失敗しました: ${stripeError.message}` },
          { status: 500 }
        )
      }
    }

    // user_plansを更新
    const updateData: Record<string, any> = {
      plan_id: newPlanId,
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
