import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'
import { getStripeClient, chargeCancellationFee } from '@/lib/stripe/cancellation-fee'
import Stripe from 'stripe'

const STRIPE = getStripeClient()
const CRON_SECRET = process.env.CRON_SECRET

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error('CRON_SECRET is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const { data: plans, error } = await supabase
      .from('user_plans')
      .select(
        'id, user_id, status, cancellation_scheduled_date, cancellation_fee, cancellation_fee_paid, stripe_subscription_id'
      )
      .eq('status', 'active')
      .lte('cancellation_scheduled_date', todayStr)
      .not('cancellation_scheduled_date', 'is', null)

    if (error) {
      console.error('Process cancellations: fetch error', error)
      return NextResponse.json({ error: 'Failed to fetch scheduled cancellations' }, { status: 500 })
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    let processed = 0
    let charged = 0
    let chargeFailed = 0

    for (const plan of plans) {
      const effectiveDate = plan.cancellation_scheduled_date || todayStr

      const updates = {
        status: 'cancelled' as const,
        ended_at: effectiveDate,
        cancellation_scheduled_date: effectiveDate,
      }

      const { error: updateError } = await supabase
        .from('user_plans')
        .update(updates)
        .eq('id', plan.id)

      if (updateError) {
        console.error('Process cancellations: failed to update plan', plan.id, updateError)
        continue
      }

      await Promise.all([
        cache.delete(cacheKey('user_plan', plan.user_id)),
        cache.delete(cacheKey('user_plans_full', plan.user_id)),
        cache.delete(cacheKey('user_full', plan.user_id)),
      ])

      if (!plan.cancellation_fee_paid && plan.cancellation_fee && plan.cancellation_fee > 0) {
        const chargeResult = await chargeCancellationFee({
          stripe: STRIPE,
          supabase,
          userId: plan.user_id,
          userPlanId: plan.id,
          amount: plan.cancellation_fee,
        })

        if (chargeResult.success) {
          charged += 1
        } else {
          chargeFailed += 1
          console.error('Process cancellations: fee charge failed', plan.id, chargeResult.error, chargeResult.code)
        }
      }

      processed += 1
    }

    return NextResponse.json({ success: true, processed, charged, chargeFailed })
  } catch (error: any) {
    console.error('Process cancellations error:', error)
    return NextResponse.json({ error: error.message || '処理に失敗しました' }, { status: 500 })
  }
}
