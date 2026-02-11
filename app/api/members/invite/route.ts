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
    const { lastName, firstName, email, password, planId, planType } = body

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
    let createdPassword: string | null = null

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
      // 新規ユーザー: 管理者がアカウントを直接作成（メール送信なし）
      const serviceClient = createServiceClient()
      const fullName = `${lastName} ${firstName}`.trim()

      // パスワードが指定されていない場合はランダム生成
      createdPassword = password || Math.random().toString(36).slice(-10) + 'A1!'

      const { data: createData, error: createError } =
        await serviceClient.auth.admin.createUser({
          email,
          password: createdPassword,
          email_confirm: true,
          user_metadata: {
            name: fullName,
            is_individual: true,
          },
        })

      if (createError) {
        console.error('Create user error:', createError)
        return NextResponse.json(
          { error: `アカウントの作成に失敗しました: ${createError.message}` },
          { status: 500 }
        )
      }

      if (!createData.user) {
        return NextResponse.json(
          { error: 'ユーザーの作成に失敗しました' },
          { status: 500 }
        )
      }

      memberUserId = createData.user.id

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

    let subscriptionItemId: string
    try {
      // 同じPriceのアイテムが既にサブスクリプションに存在するか確認
      const subscription = await stripe.subscriptions.retrieve(hostPlan.stripe_subscription_id)
      const existingItem = subscription.items.data.find(
        (item) => item.price.id === priceId
      )

      if (existingItem) {
        // 同じPriceが既にある → quantityを増やす
        const updatedItem = await stripe.subscriptionItems.update(existingItem.id, {
          quantity: (existingItem.quantity || 1) + 1,
          proration_behavior: 'none',
        })
        subscriptionItemId = updatedItem.id
        console.log(`Incremented quantity on existing item ${existingItem.id} to ${(existingItem.quantity || 1) + 1}`)
      } else {
        // 新しいPriceなので新規アイテム作成
        const itemParams: any = {
          subscription: hostPlan.stripe_subscription_id,
          price: priceId,
          metadata: {
            type: 'invited_member',
          },
        }

        if (couponId) {
          itemParams.discounts = [{ coupon: couponId }]
        }

        const newItem = await stripe.subscriptionItems.create(itemParams)
        subscriptionItemId = newItem.id
      }
    } catch (stripeError: any) {
      console.error('Stripe subscription item error:', stripeError)
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
          stripe_subscription_item_id: subscriptionItemId,
          stripe_price_id: priceId,
          shared_office: effectivePlanType === 'shared_office',
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Member plan insert error:', insertError)
      // Stripeロールバック（quantityを戻すか、アイテム削除）
      try {
        const item = await stripe.subscriptionItems.retrieve(subscriptionItemId)
        if (item.quantity && item.quantity > 1) {
          await stripe.subscriptionItems.update(subscriptionItemId, {
            quantity: item.quantity - 1,
            proration_behavior: 'none',
          })
        } else {
          await stripe.subscriptionItems.del(subscriptionItemId, { proration_behavior: 'none' })
        }
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

    const response: any = {
      success: true,
      existed: !!existingUser,
      memberPlanId: memberUserPlan.id,
    }

    // 新規ユーザーの場合、ログイン情報を返す（管理者がメンバーに伝える用）
    if (!existingUser && createdPassword) {
      response.credentials = {
        email,
        password: createdPassword,
      }
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Member invite error:', error)
    return NextResponse.json(
      { error: error.message || 'メンバー招待に失敗しました' },
      { status: 500 }
    )
  }
}
