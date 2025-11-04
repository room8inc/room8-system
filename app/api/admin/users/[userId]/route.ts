import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const { userId } = await params

    // 自分自身は削除できないようにする
    if (userId === user.id) {
      return NextResponse.json({ error: '自分自身を削除することはできません' }, { status: 400 })
    }

    // 削除対象ユーザーが管理者かどうか確認
    const { data: targetUser } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (targetUser?.is_admin) {
      return NextResponse.json({ error: '管理者ユーザーは削除できません' }, { status: 400 })
    }

    // Supabase Admin Clientを使用してauth.usersから削除
    // サービスロールキーを使用（環境変数から取得）
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

    // auth.usersから削除（Admin APIを使用）
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Auth user delete error:', authDeleteError)
      // auth.usersからの削除に失敗しても、public.usersからの削除は試行する
    }

    // public.usersから削除（CASCADEで関連データも削除される）
    const { error: publicDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (publicDeleteError) {
      console.error('Public user delete error:', publicDeleteError)
      return NextResponse.json(
        { error: `ユーザー削除に失敗しました: ${publicDeleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'ユーザーを削除しました' })
  } catch (error: any) {
    console.error('User delete error:', error)
    return NextResponse.json(
      { error: error.message || 'ユーザー削除中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

