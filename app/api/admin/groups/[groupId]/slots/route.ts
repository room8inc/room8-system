import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { isSlotPlanAllowed } from '@/lib/utils/group-plans'

type Context = { params: Promise<{ groupId: string }> }

/** POST: スロット追加 */
export async function POST(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const body = await request.json()
  const { planId, planType, options } = body

  if (!planId) {
    return NextResponse.json({ error: 'planId は必須です' }, { status: 400 })
  }

  // 既存スロットを取得してtier検証とslot_number自動採番
  const { data: existingSlots } = await supabase
    .from('group_slots')
    .select('slot_number, plan_id, plan_type, plans(*)')
    .eq('group_plan_id', groupId)
    .order('slot_number', { ascending: true })

  if (!existingSlots || existingSlots.length === 0) {
    return NextResponse.json({ error: 'グループにスロットがありません' }, { status: 400 })
  }

  // slot 1のプラン価格を取得
  const firstSlot = existingSlots[0]
  const ownerPlan = firstSlot.plans as any
  const ownerPlanPrice =
    firstSlot.plan_type === 'shared_office'
      ? ownerPlan.shared_office_price
      : ownerPlan.workspace_price

  // 新スロットのプラン情報を取得
  const { data: newPlan } = await supabase
    .from('plans')
    .select('workspace_price, shared_office_price')
    .eq('id', planId)
    .single()

  if (!newPlan) {
    return NextResponse.json({ error: 'プランが見つかりません' }, { status: 404 })
  }

  const slotPlanType = planType || 'workspace'
  const slotPrice =
    slotPlanType === 'shared_office'
      ? newPlan.shared_office_price
      : newPlan.workspace_price

  if (!isSlotPlanAllowed(ownerPlanPrice, slotPrice)) {
    return NextResponse.json(
      { error: 'スロットのプランがオーナーのプランを超えています' },
      { status: 400 }
    )
  }

  const nextSlotNumber = Math.max(...existingSlots.map((s) => s.slot_number)) + 1

  const { data: slot, error } = await supabase
    .from('group_slots')
    .insert({
      group_plan_id: groupId,
      slot_number: nextSlotNumber,
      plan_id: planId,
      plan_type: slotPlanType,
      options: options || {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, slot })
}

/** PATCH: スロットのプラン変更 */
export async function PATCH(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const body = await request.json()
  const { slotId, planId, planType } = body

  if (!slotId || !planId) {
    return NextResponse.json({ error: 'slotId と planId は必須です' }, { status: 400 })
  }

  // slot 1のプラン価格を取得してtier検証
  const { data: firstSlot } = await supabase
    .from('group_slots')
    .select('id, slot_number, plan_id, plan_type, plans(*)')
    .eq('group_plan_id', groupId)
    .order('slot_number', { ascending: true })
    .limit(1)
    .single()

  if (!firstSlot) {
    return NextResponse.json({ error: 'グループスロットが見つかりません' }, { status: 404 })
  }

  const ownerPlan = firstSlot.plans as any
  const ownerPlanPrice =
    firstSlot.plan_type === 'shared_office'
      ? ownerPlan.shared_office_price
      : ownerPlan.workspace_price

  // 変更先プランの情報を取得
  const { data: newPlan } = await supabase
    .from('plans')
    .select('workspace_price, shared_office_price')
    .eq('id', planId)
    .single()

  if (!newPlan) {
    return NextResponse.json({ error: 'プランが見つかりません' }, { status: 404 })
  }

  const slotPlanType = planType || 'workspace'

  // slot 1以外の場合のみtier検証
  if (slotId !== firstSlot.id) {
    const slotPrice =
      slotPlanType === 'shared_office'
        ? newPlan.shared_office_price
        : newPlan.workspace_price

    if (!isSlotPlanAllowed(ownerPlanPrice, slotPrice)) {
      return NextResponse.json(
        { error: 'スロットのプランがオーナーのプランを超えています' },
        { status: 400 }
      )
    }
  }

  const { error } = await supabase
    .from('group_slots')
    .update({ plan_id: planId, plan_type: slotPlanType })
    .eq('id', slotId)
    .eq('group_plan_id', groupId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/** DELETE: スロット削除 */
export async function DELETE(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const slotId = searchParams.get('slotId')

  if (!slotId) {
    return NextResponse.json({ error: 'slotId は必須です' }, { status: 400 })
  }

  // slot 1は削除不可
  const { data: slot } = await supabase
    .from('group_slots')
    .select('slot_number')
    .eq('id', slotId)
    .eq('group_plan_id', groupId)
    .single()

  if (!slot) {
    return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 })
  }

  if (slot.slot_number === 1) {
    return NextResponse.json({ error: 'スロット1は削除できません' }, { status: 400 })
  }

  const { error } = await supabase
    .from('group_slots')
    .delete()
    .eq('id', slotId)
    .eq('group_plan_id', groupId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
