import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getPlanPriceId, getOptionPriceId, getCouponId } from '@/lib/stripe/price-config'
import { getStripeMode } from '@/lib/stripe/mode'

export const runtime = 'nodejs'

type Context = { params: Promise<{ groupId: string }> }

/** POST: グループのStripeサブスクリプション作成 */
export async function POST(_request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const stripeMode = await getStripeMode()
  const stripe = getStripeClient(stripeMode)
  const supabase = await createClient()

  // グループ情報を取得
  const { data: group, error: groupError } = await supabase
    .from('group_plans')
    .select(`
      *,
      owner:users!group_plans_owner_user_id_fkey(id, name, email, stripe_customer_id, is_individual, company_name),
      group_slots(id, slot_number, plan_id, plan_type, options, plans(*))
    `)
    .eq('id', groupId)
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'グループが見つかりません' }, { status: 404 })
  }

  if (group.stripe_subscription_id) {
    return NextResponse.json({ error: 'サブスクリプションは既に作成されています' }, { status: 400 })
  }

  const owner = group.owner as any
  const slots = (group.group_slots as any[]).sort(
    (a: any, b: any) => a.slot_number - b.slot_number
  )

  if (slots.length === 0) {
    return NextResponse.json({ error: 'スロットがありません' }, { status: 400 })
  }

  // オーナーのstripe_customer_idを取得（なければ作成）
  let customerId = owner.stripe_customer_id
  if (!customerId) {
    const { formatJapaneseName } = await import('@/lib/utils/name')
    const customerName =
      !owner.is_individual && owner.company_name
        ? owner.company_name
        : formatJapaneseName(owner.name) || owner.email || undefined

    const customer = await stripe.customers.create({
      email: owner.email || undefined,
      name: customerName,
      metadata: {
        user_id: owner.id,
        group_plan_id: groupId,
      },
    })
    customerId = customer.id

    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', owner.id)
  }

  // 契約種別に基づくPrice IDの取得タイプ
  let priceType: 'monthly' | 'yearly' | 'annual_prepaid' = 'monthly'
  if (group.contract_term === 'yearly') {
    priceType = 'yearly'
  } else if (group.payment_method === 'annual_prepaid') {
    priceType = 'annual_prepaid'
  }

  // 各スロットのSubscription Itemを構築
  const subscriptionItems: any[] = []
  const groupCouponId = getCouponId('group_second_slot', stripeMode)

  for (const slot of slots) {
    const plan = slot.plans as any
    const planCode = plan.code

    // ワークスペース/シェアオフィスのPrice IDを取得
    const priceId = getPlanPriceId(planCode, priceType, stripeMode)
    if (!priceId) {
      return NextResponse.json(
        { error: `スロット${slot.slot_number}のPrice IDが見つかりません (plan: ${planCode})` },
        { status: 400 }
      )
    }

    const item: any = { price: priceId }

    // 2番目以降のスロットには50% OFFクーポンを適用
    if (slot.slot_number > 1 && groupCouponId) {
      item.discounts = [{ coupon: groupCouponId }]
    }

    subscriptionItems.push({ slotId: slot.id, item })

    // シェアオフィスの場合、オプション価格も追加
    if (slot.plan_type === 'shared_office') {
      const soPriceId = getOptionPriceId('shared_office', stripeMode)
      if (soPriceId) {
        const soItem: any = { price: soPriceId }
        if (slot.slot_number > 1 && groupCouponId) {
          soItem.discounts = [{ coupon: groupCouponId }]
        }
        subscriptionItems.push({ slotId: slot.id, item: soItem })
      }
    }

    // その他のオプション
    const options = slot.options || {}
    const optionCodes: string[] = []
    if (options.company_registration) optionCodes.push('company_registration')
    if (options.printer) optionCodes.push('printer')
    if (options.twenty_four_hours) optionCodes.push('twenty_four_hours')
    if (options.locker) {
      optionCodes.push(options.locker_size === 'large' ? 'locker_large' : 'locker_small')
    }

    for (const code of optionCodes) {
      const optPriceId = getOptionPriceId(code, stripeMode)
      if (optPriceId) {
        subscriptionItems.push({ slotId: slot.id, item: { price: optPriceId } })
      }
    }
  }

  try {
    // サブスクリプション作成
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: subscriptionItems.map((si) => si.item),
      metadata: {
        group_plan_id: groupId,
        owner_user_id: owner.id,
      },
    })

    // group_plans.stripe_subscription_id を更新
    await supabase
      .from('group_plans')
      .update({ stripe_subscription_id: subscription.id })
      .eq('id', groupId)

    // 各スロットのstripe_subscription_item_idを更新
    // メインの各スロットのPlan Price itemをマッピング
    let itemIndex = 0
    for (const si of subscriptionItems) {
      if (itemIndex < subscription.items.data.length) {
        // スロットの最初のアイテム（プラン本体）のみ記録
        const isMainItem = subscriptionItems.indexOf(si) ===
          subscriptionItems.findIndex((s) => s.slotId === si.slotId)

        if (isMainItem) {
          await supabase
            .from('group_slots')
            .update({
              stripe_subscription_item_id: subscription.items.data[itemIndex].id,
            })
            .eq('id', si.slotId)
        }
      }
      itemIndex++
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
    })
  } catch (error: any) {
    console.error('Group subscription creation error:', error)
    return NextResponse.json(
      { error: error.message || 'サブスクリプションの作成に失敗しました' },
      { status: 500 }
    )
  }
}
