import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// メールアドレスからユーザーIDを検索して削除するエンドポイント
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 })
    }

    // Supabase Admin Clientを作成
    const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseAdminUrl || !supabaseAdminKey) {
      console.error('Supabase Admin環境変数が設定されていません')
      return NextResponse.json(
        { error: 'サーバー設定エラー: 管理者機能が利用できません' },
        { status: 500 }
      )
    }

    const adminClient = createAdminClient(supabaseAdminUrl, supabaseAdminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // メールアドレスからユーザーを検索
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers()

    if (listError) {
      console.error('List users error:', listError)
      return NextResponse.json(
        { error: `ユーザー検索に失敗しました: ${listError.message}` },
        { status: 500 }
      )
    }

    // メールアドレスに一致するユーザーを検索
    const targetUser = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

    if (!targetUser) {
      return NextResponse.json(
        { error: '指定されたメールアドレスのユーザーが見つかりませんでした' },
        { status: 404 }
      )
    }

    const userId = targetUser.id

    // 自分自身は削除できないようにする
    if (userId === user.id) {
      return NextResponse.json({ error: '自分自身を削除することはできません' }, { status: 400 })
    }

    // 削除対象ユーザーが管理者かどうか確認
    const { data: targetUserData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle()

    if (targetUserData?.is_admin) {
      return NextResponse.json({ error: '管理者ユーザーは削除できません' }, { status: 400 })
    }

    // auth.usersから削除（Admin APIを使用）
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Auth user delete error:', authDeleteError)
      return NextResponse.json(
        { error: `auth.usersからの削除に失敗しました: ${authDeleteError.message}` },
        { status: 500 }
      )
    }

    // public.usersからも削除（存在する場合）
    const { error: publicDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    // public.usersに存在しない場合でもエラーにはしない（auth.usersから削除できればOK）
    if (publicDeleteError && publicDeleteError.code !== 'PGRST116') {
      console.error('Public user delete error:', publicDeleteError)
      // auth.usersからは削除できたので、警告のみ
    }

    return NextResponse.json({
      success: true,
      message: 'ユーザーを削除しました',
      userId,
      email: targetUser.email,
    })
  } catch (error: any) {
    console.error('Delete user by email error:', error)
    return NextResponse.json(
      { error: error.message || 'ユーザー削除中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

