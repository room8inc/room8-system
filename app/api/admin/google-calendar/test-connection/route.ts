import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarClientFromEnv } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

/**
 * Googleカレンダーへの接続テスト
 */
export async function GET(request: NextRequest) {
  try {
    // 環境変数の設定状況を確認
    const hasServiceAccountEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const hasPrivateKey = !!process.env.GOOGLE_PRIVATE_KEY

    if (!hasServiceAccountEmail || !hasPrivateKey) {
      return NextResponse.json({
        connected: false,
        error: '環境変数が設定されていません',
        missing: {
          serviceAccountEmail: !hasServiceAccountEmail,
          privateKey: !hasPrivateKey,
          calendarId: false, // カレンダーIDは管理画面で設定するため、環境変数は不要
        },
      })
    }

    // 接続テスト: カレンダーリストを取得してみる
    try {
      const { calendar } = getGoogleCalendarClientFromEnv()

      // カレンダーリストを取得（接続テスト）
      await calendar.calendarList.list({
        maxResults: 1,
      })

      // データベースからカレンダーIDを取得（設定されている場合）
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      let calendarId: string | undefined
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: settings } = await supabase
          .from('google_calendar_settings')
          .select('calendar_id')
          .eq('is_active', true)
          .single()
        
        if (settings) {
          calendarId = settings.calendar_id
        }
      }

      // データベースに設定がない場合は環境変数から取得（後方互換性）
      if (!calendarId) {
        calendarId = process.env.GOOGLE_CALENDAR_ID
      }

      return NextResponse.json({
        connected: true,
        message: 'Googleカレンダーへの接続に成功しました',
        calendarId: calendarId,
      })
    } catch (testError: any) {
      return NextResponse.json({
        connected: false,
        error: `接続テストに失敗しました: ${testError.message}`,
      })
    }
  } catch (error: any) {
    console.error('Google Calendar connection test error:', error)
    return NextResponse.json(
      {
        connected: false,
        error: error.message || 'Googleカレンダーの接続テスト中にエラーが発生しました',
      },
      { status: 500 }
    )
  }
}

