import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSlotPlanAllowed } from '@/lib/utils/group-plans'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getPlanPriceId, getCouponId } from '@/lib/stripe/price-config'
import { getStripeMode } from '@/lib/stripe/mode'

export const runtime = 'nodejs'

/** POST: お客さん側からのグループプラン申し込み */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // 既にグループに所属しているか確認
    const { data: existingMembership } = await supabase
      .from('group_members')
      .select('id, group_plans!inner(id, status)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('group_plans.status', 'active')
      .maybeSingle()

    if (existingMembership) {
      return NextResponse.json(
        { error: '既にグループに所属しています' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, groupType, slots } = body

    if (!name || !groupType) {
      return NextResponse.json(
        { error: 'グループ名と種別は必須です' },
        { status: 400 }
      )
    }

    if (!['family', 'corporate'].includes(groupType)) {
      return NextResponse.json({ error: '無効なグループ種別です' }, { status: 400 })
    }

    if (!slots || !Array.isArray(slots) || slots.length < 2) {
      return NextResponse.json(
        { error: 'スロットは2つ以上必要です' },
        { status: 400 }
      )
    }

    // スロットのプラン情報を取得してtier検証
    const planIds = slots.map((s: any) => s.planId)
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id, code, workspace_price, shared_office_price')
      .in('id', planIds)

    if (plansError || !plans) {
      return NextResponse.json(
        { error: 'プラン情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    const planMap = new Map(plans.map((p) => [p.id, p]))
    const firstSlotPlan = planMap.get(slots[0].planId)
    if (!firstSlotPlan) {
      return NextResponse.json(
        { error: '最初のスロットのプランが見つかりません' },
        { status: 400 }
      )
    }

    const ownerPlanPrice =
      slots[0].planType === 'shared_office'
        ? firstSlotPlan.shared_office_price
        : firstSlotPlan.workspace_price

    // slot 2+がslot 1以下か検証
    for (let i = 1; i < slots.length; i++) {
      const slotPlan = planMap.get(slots[i].planId)
      if (!slotPlan) {
        return NextResponse.json(
          { error: `スロット${i + 1}のプランが見つかりません` },
          { status: 400 }
        )
      }
      const slotPrice =
        slots[i].planType === 'shared_office'
          ? slotPlan.shared_office_price
          : slotPlan.workspace_price

      if (!isSlotPlanAllowed(ownerPlanPrice, slotPrice)) {
        return NextResponse.json(
          { error: `スロット${i + 1}のプランがスロット1のプランを超えています` },
          { status: 400 }
        )
      }
    }

    // グループ作成（ログインユーザーがオーナー）
    const { data: group, error: groupError } = await supabase
      .from('group_plans')
      .insert({
        owner_user_id: user.id,
        name,
        group_type: groupType,
        contract_term: 'monthly',
        payment_method: 'monthly',
      })
      .select()
      .single()

    if (groupError) {
      return NextResponse.json({ error: groupError.message }, { status: 500 })
    }

    // スロット作成
    const slotInserts = slots.map((s: any, index: number) => ({
      group_plan_id: group.id,
      slot_number: index + 1,
      plan_id: s.planId,
      plan_type: s.planType || 'workspace',
      options: {},
    }))

    const { data: createdSlots, error: slotsError } = await supabase
      .from('group_slots')
      .insert(slotInserts)
      .select()

    if (slotsError) {
      await supabase.from('group_plans').delete().eq('id', group.id)
      return NextResponse.json({ error: slotsError.message }, { status: 500 })
    }

    // オーナーをメンバーとして追加
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_plan_id: group.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      await supabase.from('group_plans').delete().eq('id', group.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // ========================================
    // Stripe サブスクリプション作成
    // ========================================
    const stripeMode = await getStripeMode()
    const stripe = getStripeClient(stripeMode)

    // オーナーのStripe顧客情報を取得
    const { data: ownerData } = await supabase
      .from('users')
      .select('name, email, stripe_customer_id, is_individual, company_name')
      .eq('id', user.id)
      .single()

    // Stripe顧客を取得 or 作成
    let customerId = ownerData?.stripe_customer_id
    if (!customerId) {
      const { formatJapaneseName } = await import('@/lib/utils/name')
      const customerName =
        ownerData?.is_individual === false && ownerData?.company_name
          ? ownerData.company_name
          : formatJapaneseName(ownerData?.name) || ownerData?.email || user.email || undefined

      const customer = await stripe.customers.create({
        email: ownerData?.email || user.email || undefined,
        name: customerName,
        metadata: {
          user_id: user.id,
          group_plan_id: group.id,
        },
      })
      customerId = customer.id

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // 50% OFFクーポンを取得 or 作成
    let couponId = getCouponId('group_second_slot', stripeMode)
    if (!couponId) {
      // クーポンが未設定の場合、Stripeで自動作成
      try {
        const existingCoupon = await stripe.coupons.retrieve('group_50off')
        couponId = existingCoupon.id
      } catch {
        // 存在しない場合は作成
        const newCoupon = await stripe.coupons.create({
          id: 'group_50off',
          percent_off: 50,
          duration: 'forever',
          name: 'グループプラン 2人目以降 50% OFF',
        })
        couponId = newCoupon.id
      }
    }

    // 各スロットのSubscription Itemを構築
    const subscriptionItems: { slotId: string; item: any }[] = []

    const sortedSlots = (createdSlots || []).sort(
      (a: any, b: any) => a.slot_number - b.slot_number
    )

    for (const slot of sortedSlots) {
      const plan = planMap.get(slot.plan_id)
      if (!plan) continue

      const priceId = getPlanPriceId(plan.code, 'monthly', stripeMode)
      if (!priceId) {
        console.error(`Price ID not found for plan: ${plan.code}`)
        continue
      }

      const item: any = { price: priceId }

      // 2番目以降のスロットには50% OFFクーポンを適用
      if (slot.slot_number > 1 && couponId) {
        item.discounts = [{ coupon: couponId }]
      }

      subscriptionItems.push({ slotId: slot.id, item })
    }

    if (subscriptionItems.length > 0) {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: subscriptionItems.map((si) => si.item),
        metadata: {
          group_plan_id: group.id,
          owner_user_id: user.id,
        },
      })

      // group_plans.stripe_subscription_id を更新
      await supabase
        .from('group_plans')
        .update({ stripe_subscription_id: subscription.id })
        .eq('id', group.id)

      // 各スロットのstripe_subscription_item_idを更新
      for (let i = 0; i < subscriptionItems.length; i++) {
        if (i < subscription.items.data.length) {
          await supabase
            .from('group_slots')
            .update({
              stripe_subscription_item_id: subscription.items.data[i].id,
            })
            .eq('id', subscriptionItems[i].slotId)
        }
      }

      console.log(`Group subscription created: ${subscription.id} for group ${group.id}`)
    }

    return NextResponse.json({ success: true, group })
  } catch (error: any) {
    console.error('Group creation error:', error)
    return NextResponse.json(
      { error: error.message || 'グループの作成に失敗しました' },
      { status: 500 }
    )
  }
}
