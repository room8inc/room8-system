import { cache, cacheKey } from '@/lib/cache/vercel-kv'
import { chargeCancellationFee } from '@/lib/stripe/cancellation-fee'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export interface ProcessCancellationsResult {
  processed: number
  charged: number
  chargeFailed: number
  failedUpdates: Array<{ userPlanId: string; error: string }>
}

export async function processScheduledCancellations({
  supabase,
  stripe,
  referenceDate = new Date(),
}: {
  supabase: SupabaseClient
  stripe: Stripe
  referenceDate?: Date
}): Promise<ProcessCancellationsResult> {
  const today = new Date(referenceDate)
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
    throw new Error('Failed to fetch scheduled cancellations')
  }

  if (!plans || plans.length === 0) {
    return {
      processed: 0,
      charged: 0,
      chargeFailed: 0,
      failedUpdates: [],
    }
  }

  let processed = 0
  let charged = 0
  let chargeFailed = 0
  const failedUpdates: Array<{ userPlanId: string; error: string }> = []

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
      failedUpdates.push({ userPlanId: plan.id, error: updateError.message })
      continue
    }

    await Promise.all([
      cache.delete(cacheKey('user_plan', plan.user_id)),
      cache.delete(cacheKey('user_plans_full', plan.user_id)),
      cache.delete(cacheKey('user_full', plan.user_id)),
    ])

    if (!plan.cancellation_fee_paid && plan.cancellation_fee && plan.cancellation_fee > 0) {
      const chargeResult = await chargeCancellationFee({
        stripe,
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

  return {
    processed,
    charged,
    chargeFailed,
    failedUpdates,
  }
}

