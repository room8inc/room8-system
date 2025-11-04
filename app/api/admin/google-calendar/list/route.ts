import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarClientFromEnv } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

/**
 * Googleカレンダーの一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { calendar } = getGoogleCalendarClientFromEnv()

    // カレンダーリストを取得
    const response = await calendar.calendarList.list({
      minAccessRole: 'writer', // 編集権限があるカレンダーのみ
    })

    const calendars = (response.data.items || []).map((cal) => ({
      id: cal.id,
      name: cal.summary || cal.id,
      description: cal.description || '',
      accessRole: cal.accessRole,
    }))

    return NextResponse.json({ calendars })
  } catch (error: any) {
    console.error('Google Calendar list API error:', error)
    return NextResponse.json(
      { error: error.message || 'Googleカレンダーの取得に失敗しました' },
      { status: 500 }
    )
  }
}

