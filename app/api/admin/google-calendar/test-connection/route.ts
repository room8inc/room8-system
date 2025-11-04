import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarClient } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

/**
 * Googleカレンダーへの接続テスト
 */
export async function GET(request: NextRequest) {
  try {
    // 環境変数の設定状況を確認
    const hasServiceAccountEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const hasPrivateKey = !!process.env.GOOGLE_PRIVATE_KEY
    const hasCalendarId = !!process.env.GOOGLE_CALENDAR_ID

    if (!hasServiceAccountEmail || !hasPrivateKey || !hasCalendarId) {
      return NextResponse.json({
        connected: false,
        error: '環境変数が設定されていません',
        missing: {
          serviceAccountEmail: !hasServiceAccountEmail,
          privateKey: !hasPrivateKey,
          calendarId: !hasCalendarId,
        },
      })
    }

    // 接続テスト: 今日の予定を1件取得してみる
    try {
      const { calendar, calendarId } = getGoogleCalendarClient()

      if (!calendar || !calendarId) {
        throw new Error('Google Calendarクライアントの取得に失敗しました')
      }

      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)

      await calendar.events.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        timeMax: tomorrow.toISOString(),
        maxResults: 1,
      })

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

