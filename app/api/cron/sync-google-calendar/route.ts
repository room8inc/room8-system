import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleCalendarEvents } from '@/lib/utils/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * Googleカレンダーの定期同期ジョブ（1日1回実行）
 * Vercel Cronから呼び出される
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronからのリクエストか確認（オプション）
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 今日から30日後までのイベントを同期
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 1) // 1日前から（念のため）
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + 30) // 30日後まで

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    const result = await syncGoogleCalendarEvents(startDateStr, endDateStr)

    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      startDate: startDateStr,
      endDate: endDateStr,
    })
  } catch (error: any) {
    console.error('定期同期エラー:', error)
    return NextResponse.json(
      { error: error.message || '定期同期に失敗しました' },
      { status: 500 }
    )
  }
}

