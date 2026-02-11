import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** DELETE: オーナー/adminがメンバーを削除 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // このユーザーがグループのowner/adminか確認
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_plan_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (!membership) {
    return NextResponse.json(
      { error: 'グループの管理権限がありません' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')

  if (!memberId) {
    return NextResponse.json({ error: 'memberId は必須です' }, { status: 400 })
  }

  // 対象メンバーの確認
  const { data: targetMember } = await supabase
    .from('group_members')
    .select('role')
    .eq('id', memberId)
    .eq('group_plan_id', membership.group_plan_id)
    .single()

  if (!targetMember) {
    return NextResponse.json(
      { error: 'メンバーが見つかりません' },
      { status: 404 }
    )
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json(
      { error: 'オーナーは削除できません' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('group_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .eq('group_plan_id', membership.group_plan_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
