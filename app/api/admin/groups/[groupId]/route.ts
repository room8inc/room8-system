import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

type Context = { params: Promise<{ groupId: string }> }

/** GET: グループ詳細 */
export async function GET(_request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()

  const { data: group, error } = await supabase
    .from('group_plans')
    .select(`
      *,
      owner:users!group_plans_owner_user_id_fkey(id, name, email),
      group_slots(id, slot_number, plan_id, plan_type, options, stripe_subscription_item_id, plans(*)),
      group_members(id, user_id, role, status, users(id, name, email))
    `)
    .eq('id', groupId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 現在のチェックイン状況を取得
  const { data: activeCheckins } = await supabase
    .from('checkins')
    .select('id, user_id, group_slot_id, checkin_at, users(name)')
    .eq('group_plan_id', groupId)
    .is('checkout_at', null)

  return NextResponse.json({ group, activeCheckins: activeCheckins || [] })
}

/** PATCH: グループ更新（名前変更、ステータス変更） */
export async function PATCH(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const body = await request.json()

  const updateData: Record<string, unknown> = {}
  if (body.name) updateData.name = body.name
  if (body.status) {
    if (!['active', 'cancelled', 'suspended'].includes(body.status)) {
      return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
    }
    updateData.status = body.status
  }

  const { error } = await supabase
    .from('group_plans')
    .update(updateData)
    .eq('id', groupId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/** DELETE: ソフトデリート */
export async function DELETE(_request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()

  const { error } = await supabase
    .from('group_plans')
    .update({ status: 'cancelled' })
    .eq('id', groupId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
