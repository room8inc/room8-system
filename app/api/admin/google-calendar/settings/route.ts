import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export const runtime = 'nodejs'

/**
 * Googleカレンダー設定を保存
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { calendarId, calendarName } = body

    if (!calendarId) {
      return NextResponse.json({ error: 'カレンダーIDが必要です' }, { status: 400 })
    }

    // 既存のアクティブな設定を無効化
    await supabase
      .from('google_calendar_settings')
      .update({ is_active: false })
      .eq('is_active', true)

    // 新しい設定を追加
    const { data, error } = await supabase
      .from('google_calendar_settings')
      .insert({
        calendar_id: calendarId,
        calendar_name: calendarName || calendarId,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Google Calendar settings save error:', error)
      return NextResponse.json(
        { error: `設定の保存に失敗しました: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, settings: data })
  } catch (error: any) {
    console.error('Google Calendar settings API error:', error)
    return NextResponse.json(
      { error: error.message || '設定の保存中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

/**
 * 現在の設定を取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('google_calendar_settings')
      .select('*')
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116は「データが見つからない」エラー（許容）
      console.error('Google Calendar settings fetch error:', error)
      return NextResponse.json(
        { error: `設定の取得に失敗しました: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings: data || null })
  } catch (error: any) {
    console.error('Google Calendar settings API error:', error)
    return NextResponse.json(
      { error: error.message || '設定の取得中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

