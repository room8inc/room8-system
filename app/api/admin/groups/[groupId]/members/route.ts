import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

type Context = { params: Promise<{ groupId: string }> }

/** POST: メンバー追加 */
export async function POST(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const body = await request.json()
  const { userId, role } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId は必須です' }, { status: 400 })
  }

  const memberRole = role || 'member'
  if (!['owner', 'admin', 'member'].includes(memberRole)) {
    return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
  }

  // 既にメンバーかチェック
  const { data: existing } = await supabase
    .from('group_members')
    .select('id, status')
    .eq('group_plan_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json({ error: '既にメンバーです' }, { status: 400 })
    }
    // removed状態なら再アクティブ化
    const { error } = await supabase
      .from('group_members')
      .update({ status: 'active', role: memberRole })
      .eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase
    .from('group_members')
    .insert({
      group_plan_id: groupId,
      user_id: userId,
      role: memberRole,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/** PATCH: ロール変更 */
export async function PATCH(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const body = await request.json()
  const { memberId, role } = body

  if (!memberId || !role) {
    return NextResponse.json({ error: 'memberId と role は必須です' }, { status: 400 })
  }

  if (!['owner', 'admin', 'member'].includes(role)) {
    return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
  }

  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('id', memberId)
    .eq('group_plan_id', groupId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/** DELETE: メンバー削除（ソフトデリート） */
export async function DELETE(request: NextRequest, context: Context) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const { groupId } = await context.params
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')

  if (!memberId) {
    return NextResponse.json({ error: 'memberId は必須です' }, { status: 400 })
  }

  // ownerは削除不可
  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('id', memberId)
    .eq('group_plan_id', groupId)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  }

  if (member.role === 'owner') {
    return NextResponse.json({ error: 'オーナーは削除できません' }, { status: 400 })
  }

  const { error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .eq('group_plan_id', groupId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
