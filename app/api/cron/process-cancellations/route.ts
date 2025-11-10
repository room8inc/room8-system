import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { processScheduledCancellations } from '@/lib/cron/process-cancellations'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
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

    const supabase = await createClient()
    const stripe = getStripeClient()

    const summary = await processScheduledCancellations({
      supabase,
      stripe,
    })

    return NextResponse.json({ success: true, ...summary })
  } catch (error: any) {
    console.error('Process cancellations error:', error)
    return NextResponse.json({ error: error.message || '処理に失敗しました' }, { status: 500 })
  }
}
