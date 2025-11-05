import { NextRequest, NextResponse } from 'next/server'
import { deleteGoogleCalendarEvent } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'イベントIDが指定されていません' },
        { status: 400 }
      )
    }

    await deleteGoogleCalendarEvent(eventId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Calendar event deletion API error:', error)
    return NextResponse.json(
      { error: error.message || 'Googleカレンダーからの予定削除に失敗しました' },
      { status: 500 }
    )
  }
}

