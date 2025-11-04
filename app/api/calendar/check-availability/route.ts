import { NextRequest, NextResponse } from 'next/server'
import { checkGoogleCalendarAvailability } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, startTime, endTime } = body

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: '日時が指定されていません' },
        { status: 400 }
      )
    }

    const result = await checkGoogleCalendarAvailability(date, startTime, endTime)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Calendar availability check API error:', error)
    return NextResponse.json(
      { error: error.message || '空き状況の確認に失敗しました' },
      { status: 500 }
    )
  }
}

