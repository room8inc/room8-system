import { NextRequest, NextResponse } from 'next/server'
import { createGoogleCalendarEvent } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, startTime, endTime, title, description } = body

    if (!date || !startTime || !endTime || !title) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      )
    }

    const eventId = await createGoogleCalendarEvent(
      date,
      startTime,
      endTime,
      title,
      description
    )

    return NextResponse.json({ eventId })
  } catch (error: any) {
    console.error('Calendar event creation API error:', error)
    return NextResponse.json(
      { error: error.message || 'Googleカレンダーへの予定追加に失敗しました' },
      { status: 500 }
    )
  }
}

