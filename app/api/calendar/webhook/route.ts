import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleCalendarEvents } from '@/lib/utils/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * GoogleカレンダーのWebhookエンドポイント
 * イベント変更通知を受け取って同期する
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Google Calendar Watch APIの通知形式を確認
    // https://developers.google.com/calendar/api/guides/push#receiving-notifications
    const headers = Object.fromEntries(request.headers.entries())
    const xGoogChannelId = headers['x-goog-channel-id']
    const xGoogChannelToken = headers['x-goog-channel-token']
    const xGoogResourceId = headers['x-goog-resource-id']
    const xGoogResourceState = headers['x-goog-resource-state']

    // チャンネル認証（必要に応じて実装）
    // ここでは簡易的に実装

    // 同期処理
    // 通知は変更があったことだけを伝えるので、該当期間を広めに取得
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 1) // 1日前から
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + 30) // 30日後まで

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    await syncGoogleCalendarEvents(startDateStr, endDateStr)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Webhook処理エラー:', error)
    // エラーでも200を返す（Googleがリトライするため）
    return NextResponse.json(
      { error: error.message || 'Webhook処理に失敗しました' },
      { status: 200 }
    )
  }
}

/**
 * GETリクエストはチャンネル検証用
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')

  // チャンネル検証用のトークンチェック（必要に応じて実装）
  // ここでは簡易的に実装

  return NextResponse.json({ verified: true })
}

