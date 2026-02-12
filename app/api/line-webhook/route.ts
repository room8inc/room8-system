import { NextResponse, type NextRequest } from 'next/server'
import { verifySignature } from '@/lib/line/verify-signature'
import { handleEvent } from '@/lib/line/handle-event'
import type { WebhookEvent } from '@line/bot-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('=== LINE Webhook POST ===')

  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature') || ''

    // 署名検証
    if (!verifySignature(body, signature)) {
      console.warn('LINE Webhook: Invalid signature')
      return NextResponse.json({ success: true })
    }

    const parsed = JSON.parse(body)
    const events: WebhookEvent[] = parsed.events || []

    // 各イベントを並列処理
    const results = await Promise.allSettled(
      events.map((event) => handleEvent(event))
    )
    // エラーがあればログ出力
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('LINE handleEvent error:', result.reason)
      }
    }
  } catch (error) {
    console.error('LINE Webhook error:', error)
  }

  // 常に200を返す（LINE再送防止）
  return NextResponse.json({ success: true })
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
