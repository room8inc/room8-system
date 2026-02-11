import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service-client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // このユーザーがグループのowner/adminか確認
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_plan_id, role, group_plans!inner(id, status)')
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

  const groupPlanId = membership.group_plan_id

  const body = await request.json()
  const { email, lastName, firstName } = body

  if (!email || !lastName || !firstName) {
    return NextResponse.json(
      { error: 'メールアドレス、姓、名は必須です' },
      { status: 400 }
    )
  }

  const fullName = `${lastName} ${firstName}`.trim()

  // 既にグループメンバーかチェック（メールで）
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    // 既にユーザーが存在する場合、グループメンバーに追加
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id, status')
      .eq('group_plan_id', groupPlanId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingMember?.status === 'active') {
      return NextResponse.json(
        { error: 'このユーザーは既にグループメンバーです' },
        { status: 400 }
      )
    }

    if (existingMember) {
      // removed状態なら再アクティブ化
      await supabase
        .from('group_members')
        .update({ status: 'active', role: 'member' })
        .eq('id', existingMember.id)
    } else {
      await supabase.from('group_members').insert({
        group_plan_id: groupPlanId,
        user_id: existingUser.id,
        role: 'member',
      })
    }

    return NextResponse.json({ success: true, existed: true })
  }

  // 新規ユーザー: Supabase Auth で招待
  const serviceClient = createServiceClient()

  const { data: inviteData, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        name: fullName,
        is_individual: true,
        invited_to_group: groupPlanId,
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

  // トリガーでpublic.usersに作成される。少し待ってからgroup_membersに追加
  // （トリガーは同期実行なのでほぼ即座だが念のため）
  await new Promise((resolve) => setTimeout(resolve, 500))

  // group_membersに追加
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_plan_id: groupPlanId,
      user_id: inviteData.user.id,
      role: 'member',
    })

  if (memberError) {
    console.error('Member insert error:', memberError)
    // ユーザーは作成されたがメンバー追加に失敗 → 管理画面から手動追加を案内
    return NextResponse.json(
      { error: 'メンバー登録に失敗しました。管理者にお問い合わせください。' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, existed: false })
}
