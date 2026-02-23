import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleCalendarEvents } from '@/lib/utils/google-calendar-sync'
import { checkAndRenewWatchChannel } from '@/lib/utils/google-calendar-watch'

export const runtime = 'nodejs'

/**
 * Googleカレンダーの定期同期ジョブ（1日1回実行）
 * Vercel Cronから呼び出される
 *
 * 実行内容:
 * 1. Watchチャンネルの有効期限をチェックし、必要に応じて自動再登録
 * 2. 全アクティブカレンダーのイベントをDBに同期
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'

    if (cronSecret) {
      const expected = `Bearer ${cronSecret}`
      if (authHeader !== expected && !isVercelCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Watchチャンネルの有効期限をチェックし、必要に応じて自動再登録（残り1日以内で再登録）
    let watchChannelRenewed = false
    let watchChannelReason = ''
    try {
      const watchResult = await checkAndRenewWatchChannel(1) // 残り1日以内で再登録
      watchChannelRenewed = watchResult.renewed
      watchChannelReason = watchResult.reason || ''
      if (watchChannelRenewed) {
        console.log(`Watchチャンネルを自動再登録しました: ${watchChannelReason}`)
      } else {
        console.log(`Watchチャンネルチェック: ${watchChannelReason}`)
      }
    } catch (watchError: any) {
      console.error('Watchチャンネルチェックエラー:', watchError)
      // エラーでも同期処理は続行
    }

    // 2. 今日から30日後までのイベントを同期（全アクティブカレンダー）
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
      calendars: result.calendars,
      startDate: startDateStr,
      endDate: endDateStr,
      watchChannelRenewed,
      watchChannelReason,
    })
  } catch (error: any) {
    console.error('定期同期エラー:', error)
    return NextResponse.json(
      { error: error.message || '定期同期に失敗しました' },
      { status: 500 }
    )
  }
}
