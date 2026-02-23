import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export const runtime = 'nodejs'

/**
 * Googleカレンダー設定を保存（calendarRole対応）
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
    const { calendarId, calendarName, calendarRole = 'meeting_room' } = body

    if (!calendarId) {
      return NextResponse.json({ error: 'カレンダーIDが必要です' }, { status: 400 })
    }

    if (!['meeting_room', 'personal'].includes(calendarRole)) {
      return NextResponse.json({ error: 'calendarRoleは meeting_room または personal のみです' }, { status: 400 })
    }

    // 同じロールの既存アクティブ設定を無効化
    await supabase
      .from('google_calendar_settings')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('calendar_role', calendarRole)

    // 新しい設定を追加
    const { data, error } = await supabase
      .from('google_calendar_settings')
      .insert({
        calendar_id: calendarId,
        calendar_name: calendarName || calendarId,
        calendar_role: calendarRole,
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
 * 現在の設定を取得（全アクティブカレンダー）
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

    if (error) {
      console.error('Google Calendar settings fetch error:', error)
      return NextResponse.json(
        { error: `設定の取得に失敗しました: ${error.message}` },
        { status: 500 }
      )
    }

    // 後方互換性: settingsフィールドにmeeting_roomのデータを入れる
    const meetingRoom = data?.find(s => s.calendar_role === 'meeting_room') || null
    const personal = data?.find(s => s.calendar_role === 'personal') || null

    return NextResponse.json({
      settings: meetingRoom,
      allSettings: data || [],
      personalSettings: personal,
    })
  } catch (error: any) {
    console.error('Google Calendar settings API error:', error)
    return NextResponse.json(
      { error: error.message || '設定の取得中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

/**
 * カレンダー設定を削除（ロール指定で無効化）
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const calendarRole = searchParams.get('calendarRole')

    if (!calendarRole) {
      return NextResponse.json({ error: 'calendarRoleが必要です' }, { status: 400 })
    }

    const { error } = await supabase
      .from('google_calendar_settings')
      .update({ is_active: false })
      .eq('is_active', true)
      .eq('calendar_role', calendarRole)

    if (error) {
      return NextResponse.json(
        { error: `設定の削除に失敗しました: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '設定の削除中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
