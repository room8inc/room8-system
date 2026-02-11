import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service-client'
import { getStripeMode } from '@/lib/stripe/mode'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getPlanPriceId, getCouponId } from '@/lib/stripe/price-config'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
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
    const { lastName, firstName, email, planId, planType } = body

    if (!lastName || !firstName || !email || !planId) {
      return NextResponse.json(
        { error: '姓、名、メールアドレス、プランIDは必須です' },
        { status: 400 }
      )
    }

    // メイン会員のアクティブな契約を確認
    const { data: hostPlan, error: hostPlanError } = await supabase
      .from('user_plans')
      .select('id, plan_id, plan_type, stripe_subscription_id, plans:plan_id(id, code, name, workspace_price, shared_office_price)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .is('invited_by', null) // 自分自身が招待メンバーでないこと
      .maybeSingle()

    if (hostPlanError || !hostPlan) {
      return NextResponse.json(
        { error: 'アクティブな契約が見つかりません。先にプランを契約してください。' },
        { status: 400 }
      )
    }

    if (!hostPlan.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Stripeサブスクリプションが見つかりません' },
        { status: 400 }
      )
    }

    // メンバー用プランの情報を取得
    const { data: memberPlan, error: memberPlanError } = await supabase
      .from('plans')
      .select('id, code, name, workspace_price, shared_office_price, is_active')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (memberPlanError || !memberPlan) {
      return NextResponse.json(
        { error: 'プラン情報が見つかりません' },
        { status: 404 }
      )
    }

    // メンバーのプラン価格 ≤ メイン会員のプラン価格を検証
    const hostPlanData = Array.isArray(hostPlan.plans) ? hostPlan.plans[0] : hostPlan.plans
    const hostPrice = hostPlan.plan_type === 'shared_office'
      ? hostPlanData?.shared_office_price
      : hostPlanData?.workspace_price
    const effectivePlanType = planType || 'workspace'
    const memberPrice = effectivePlanType === 'shared_office'
      ? memberPlan.shared_office_price
      : memberPlan.workspace_price

    if (hostPrice && memberPrice && memberPrice > hostPrice) {
      return NextResponse.json(
        { error: 'メンバーのプランはメイン会員のプラン以下である必要があります' },
        { status: 400 }
      )
    }

    // 既存ユーザーチェック
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    let memberUserId: string

    if (existingUser) {
      memberUserId = existingUser.id

      // 既にこのホストに招待されているかチェック
      const { data: existingInvite } = await supabase
        .from('user_plans')
        .select('id')
        .eq('user_id', memberUserId)
        .eq('invited_by', user.id)
        .eq('status', 'active')
        .is('ended_at', null)
        .maybeSingle()

      if (existingInvite) {
        return NextResponse.json(
          { error: 'このユーザーは既にメンバーとして招待済みです' },
          { status: 400 }
        )
      }
    } else {
      // 新規ユーザー: Supabase Authで招待
      const serviceClient = createServiceClient()
      const fullName = `${lastName} ${firstName}`.trim()

      const { data: inviteData, error: inviteError } =
        await serviceClient.auth.admin.inviteUserByEmail(email, {
          data: {
            name: fullName,
            is_individual: true,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://room8-system.vercel.app'}/auth/callback`,
        })

      if (inviteError) {
        console.error('Invite error:', inviteError)
        return NextResponse.json(
          { error: `招待メールの送信に失敗しました: ${inviteError.message}` },
          { status: 500 }
        )
      }

      if (!inviteData.user) {
        return NextResponse.json(
          { error: 'ユーザーの作成に失敗しました' },
          { status: 500 }
        )
      }

      memberUserId = inviteData.user.id

      // トリガーでpublic.usersに作成されるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Stripeサブスクリプションにアイテム追加（50% OFFクーポン付き）
    const priceId = getPlanPriceId(memberPlan.code, 'monthly', stripeMode)
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe価格IDが見つかりません' },
        { status: 500 }
      )
    }

    const couponId = getCouponId('group_second_slot', stripeMode)

    let subscriptionItem
    try {
      const itemParams: any = {
        subscription: hostPlan.stripe_subscription_id,
        price: priceId,
        metadata: {
          member_user_id: memberUserId,
          type: 'invited_member',
        },
      }

      // クーポンIDが設定されている場合のみ割引を適用
      if (couponId) {
        itemParams.discounts = [{ coupon: couponId }]
      }

      subscriptionItem = await stripe.subscriptionItems.create(itemParams)
    } catch (stripeError: any) {
      console.error('Stripe subscription item creation error:', stripeError)
      return NextResponse.json(
        { error: `Stripeサブスクリプションアイテムの追加に失敗しました: ${stripeError.message}` },
        { status: 500 }
      )
    }

    // シェアオフィスオプションのPriceIDも追加
    if (effectivePlanType === 'shared_office') {
      const { getOptionPriceId } = await import('@/lib/stripe/price-config')
      const sharedOfficePriceId = getOptionPriceId('shared_office', stripeMode)
      if (sharedOfficePriceId) {
        try {
          await stripe.subscriptionItems.create({
            subscription: hostPlan.stripe_subscription_id,
            price: sharedOfficePriceId,
            metadata: {
              member_user_id: memberUserId,
              type: 'invited_member_option',
              option: 'shared_office',
            },
          })
        } catch (err: any) {
          console.error('Shared office option add error:', err.message)
        }
      }
    }

    // user_plans にメンバーのプランを作成
    const today = new Date().toISOString().split('T')[0]
    const { data: memberUserPlan, error: insertError } = await supabase
      .from('user_plans')
      .insert({
        user_id: memberUserId,
        plan_id: planId,
        plan_type: effectivePlanType,
        started_at: today,
        status: 'active',
        contract_term: 'monthly',
        payment_method: 'monthly',
        invited_by: user.id,
        discount_code: 'group_50off',
        entry_fee: 0,
        entry_fee_discount: 0,
        first_month_free: false,
        options: {
          stripe_subscription_item_id: subscriptionItem.id,
          shared_office: effectivePlanType === 'shared_office',
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Member plan insert error:', insertError)
      // Stripeアイテムを削除（ロールバック）
      try {
        await stripe.subscriptionItems.del(subscriptionItem.id)
      } catch (e) {
        console.error('Stripe rollback error:', e)
      }
      return NextResponse.json(
        { error: 'メンバーのプラン作成に失敗しました' },
        { status: 500 }
      )
    }

    // キャッシュクリア
    await Promise.all([
      cache.delete(cacheKey('user_plan', memberUserId)),
      cache.delete(cacheKey('user_plans_full', memberUserId)),
      cache.delete(cacheKey('user_full', memberUserId)),
      cache.delete(cacheKey('user', memberUserId)),
      cache.delete(cacheKey('user_plan', user.id)),
      cache.delete(cacheKey('user_plans_full', user.id)),
    ])

    return NextResponse.json({
      success: true,
      existed: !!existingUser,
      memberPlanId: memberUserPlan.id,
    })
  } catch (error: any) {
    console.error('Member invite error:', error)
    return NextResponse.json(
      { error: error.message || 'メンバー招待に失敗しました' },
      { status: 500 }
    )
  }
}
