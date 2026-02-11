import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { isSlotPlanAllowed } from '@/lib/utils/group-plans'

/** GET: 全グループ一覧 */
export async function GET() {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: groups, error } = await supabase
    .from('group_plans')
    .select(`
      *,
      owner:users!group_plans_owner_user_id_fkey(id, name, email),
      group_slots(id, slot_number, plan_id, plan_type, plans(*)),
      group_members(id, user_id, role, status, users(id, name, email))
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ groups })
}

/** POST: グループ作成 */
export async function POST(request: NextRequest) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const supabase = await createClient()
  const body = await request.json()
  const { ownerUserId, name, groupType, contractTerm, slots } = body

  if (!ownerUserId || !name || !groupType) {
    return NextResponse.json(
      { error: 'ownerUserId, name, groupType は必須です' },
      { status: 400 }
    )
  }

  if (!['family', 'corporate'].includes(groupType)) {
    return NextResponse.json({ error: '無効なグループ種別です' }, { status: 400 })
  }

  // スロット情報を検証
  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: 'スロット情報が必要です' }, { status: 400 })
  }

  // スロットのプラン情報を取得してtier検証
  const planIds = slots.map((s: any) => s.planId)
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('id, code, workspace_price, shared_office_price')
    .in('id', planIds)

  if (plansError || !plans) {
    return NextResponse.json({ error: 'プラン情報の取得に失敗しました' }, { status: 500 })
  }

  const planMap = new Map(plans.map((p) => [p.id, p]))
  const firstSlotPlan = planMap.get(slots[0].planId)
  if (!firstSlotPlan) {
    return NextResponse.json({ error: '最初のスロットのプランが見つかりません' }, { status: 400 })
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
        { error: `スロット${i + 1}のプランがオーナーのプランを超えています` },
        { status: 400 }
      )
    }
  }

  // グループ作成
  const { data: group, error: groupError } = await supabase
    .from('group_plans')
    .insert({
      owner_user_id: ownerUserId,
      name,
      group_type: groupType,
      contract_term: contractTerm || 'monthly',
      payment_method: contractTerm || 'monthly',
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
    options: s.options || {},
  }))

  const { error: slotsError } = await supabase
    .from('group_slots')
    .insert(slotInserts)

  if (slotsError) {
    return NextResponse.json({ error: slotsError.message }, { status: 500 })
  }

  // オーナーをメンバーとして追加
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_plan_id: group.id,
      user_id: ownerUserId,
      role: 'owner',
    })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, group })
}
