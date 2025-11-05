import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarClient } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

/**
 * Googleカレンダーから週全体のイベントを取得
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body // YYYY-MM-DD形式

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '日付範囲が指定されていません' },
        { status: 400 }
      )
    }

    const { calendar, calendarId } = await getGoogleCalendarClient()

    // 週の開始日時と終了日時（日本時間）
    const dayStart = new Date(`${startDate}T00:00:00+09:00`)
    const dayEnd = new Date(`${endDate}T23:59:59+09:00`)

    // Googleカレンダーから予定を取得
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = (response.data.items || []).map((event: any) => ({
      id: event.id,
      summary: event.summary || '',
      start: event.start?.dateTime || null,
      end: event.end?.dateTime || null,
    }))

    return NextResponse.json({ events })
  } catch (error: any) {
    console.error('Google Calendar events fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Googleカレンダーの取得に失敗しました' },
      { status: 500 }
    )
  }
}

