import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSlotPlanAllowed } from '@/lib/utils/group-plans'

/** POST: お客さん側からのグループプラン申し込み */
export async function POST(request: NextRequest) {
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

  const { error: slotsError } = await supabase
    .from('group_slots')
    .insert(slotInserts)

  if (slotsError) {
    // ロールバック: グループを削除
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
    // ロールバック: グループとスロットを削除（CASCADE）
    await supabase.from('group_plans').delete().eq('id', group.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, group })
}
