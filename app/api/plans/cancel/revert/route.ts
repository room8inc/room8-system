import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'
import Stripe from 'stripe'

function getStripeClient(): Stripe {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY ??
    process.env.STRIPE_SECRET_KEY_TEST
  if (!stripeSecretKey) {
    throw new Error('Stripeのシークレットキーが設定されていません')
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const stripe = getStripeClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { userPlanId } = body

    if (!userPlanId) {
      return NextResponse.json({ error: 'userPlanIdが必要です' }, { status: 400 })
    }

    const { data: plan, error: planError } = await supabase
      .from('user_plans')
      .select(
        'id, user_id, status, ended_at, cancellation_scheduled_date, stripe_subscription_id, cancellation_fee, cancellation_fee_paid'
      )
      .eq('id', userPlanId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'プラン情報が見つかりません' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const isScheduledCancellation =
      (plan.status === 'active' || plan.status === 'cancelled') &&
      plan.cancellation_scheduled_date !== null &&
      plan.cancellation_scheduled_date >= todayStr &&
      plan.ended_at === null

    if (!isScheduledCancellation) {
      return NextResponse.json(
        { error: '解約を取り消せる状態ではありません' },
        { status: 400 }
      )
    }

    if (plan.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(plan.stripe_subscription_id, {
          cancel_at: null,
          cancel_at_period_end: false,
        })
      } catch (stripeError: any) {
        if (
          stripeError?.code !== 'resource_missing' &&
          !stripeError?.message?.includes('No such subscription')
        ) {
          console.error('Stripe subscription revert error:', stripeError)
          return NextResponse.json(
            {
              error: 'Stripeサブスクリプションの再開に失敗しました',
              details: stripeError?.message,
            },
            { status: 500 }
          )
        }
      }
    }

    const { error: updateError } = await supabase
      .from('user_plans')
      .update({
        status: 'active',
        ended_at: null,
        cancellation_scheduled_date: null,
        cancellation_fee: 0,
        cancellation_fee_paid: false,
      })
      .eq('id', plan.id)

    if (updateError) {
      return NextResponse.json(
        { error: 'プラン情報の更新に失敗しました' },
        { status: 500 }
      )
    }

    await Promise.all([
      cache.delete(cacheKey('user_plan', user.id)),
      cache.delete(cacheKey('user_plans_full', user.id)),
      cache.delete(cacheKey('user_full', user.id)),
    ])

    return NextResponse.json({ success: true, message: '解約申請を取り消しました' })
  } catch (error: any) {
    console.error('Cancellation revert error:', error)
    return NextResponse.json(
      { error: error.message || '解約申請の取り消しに失敗しました' },
      { status: 500 }
    )
  }
}
