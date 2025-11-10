import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'
import Stripe from 'stripe'

type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null
}

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

/**
 * 退会申請API
 * 
 * 15日までに申請すれば翌月1日から適用
 * 長期契約割引（年契約）の場合は解約料金が必要
 */
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
    const { userPlanId, cancellationDate, cancellationFee } = body

    let effectiveCancellationDate = cancellationDate

    if (!userPlanId || !cancellationDate) {
      return NextResponse.json(
        { error: 'userPlanIdとcancellationDateが必要です' },
        { status: 400 }
      )
    }

    // 現在のプランを確認
    const { data: currentPlan, error: planError } = await supabase
      .from('user_plans')
      .select('id, user_id, status, stripe_subscription_id')
      .eq('id', userPlanId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single()

    if (planError || !currentPlan) {
      return NextResponse.json(
        { error: 'プラン情報が見つかりません' },
        { status: 404 }
      )
    }

    // 即時解約か将来解約かを判定
    const cancellationDateObj = new Date(cancellationDate)
    cancellationDateObj.setHours(0, 0, 0, 0)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const minimumCancellationDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    minimumCancellationDate.setHours(0, 0, 0, 0)

    if (cancellationDateObj.getTime() < minimumCancellationDate.getTime()) {
      return NextResponse.json(
        {
          error: '解約日は翌月以降の日付を指定してください',
          minCancellationDate: minimumCancellationDate.toISOString().split('T')[0],
        },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('user_plans')
      .update({
        cancellation_scheduled_date: cancellationDate,
        cancellation_fee: cancellationFee || 0,
        cancellation_fee_paid: false,
      })
      .eq('id', userPlanId)

    if (updateError) {
      console.error('Cancellation update error:', updateError)
      return NextResponse.json(
        { error: '退会申請の更新に失敗しました' },
        { status: 500 }
      )
    }

    await Promise.all([
      cache.delete(cacheKey('user_plan', user.id)),
      cache.delete(cacheKey('user_plans_full', user.id)),
      cache.delete(cacheKey('user_full', user.id)),
    ])
 
    // Stripeサブスクリプションを更新
    if (currentPlan.stripe_subscription_id) {
      try {
        const subscriptionId = currentPlan.stripe_subscription_id

        let subscription: StripeSubscriptionWithPeriod | null = null
        try {
          const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
          subscription = subscriptionResponse as StripeSubscriptionWithPeriod
        } catch (retrieveError: any) {
          if (retrieveError?.code === 'resource_missing' || retrieveError?.message?.includes('No such subscription')) {
            console.warn(
              `Subscription ${subscriptionId} is already canceled or missing when retrieving. Continuing.`
            )
          } else {
            throw retrieveError
          }
        }

        if (subscription) {
          if (subscription.status === 'canceled') {
            console.warn(`Subscription ${subscriptionId} is already canceled. Skipping Stripe cancellation.`)
          } else {
            const requestedCancelAt = Math.floor(cancellationDateObj.getTime() / 1000)
            const currentPeriodEnd =
              subscription.current_period_end != null ? subscription.current_period_end : requestedCancelAt
            const normalizedCancelAt = Math.max(requestedCancelAt, currentPeriodEnd)

            console.info(
              'Stripe cancellation scheduling info:',
              JSON.stringify(
                {
                  subscriptionId,
                  subscriptionStatus: subscription.status,
                  subscriptionCancelAt: subscription.cancel_at,
                  subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
                  requestedCancelAt,
                  currentPeriodEnd,
                  normalizedCancelAt,
                },
                null,
                2
              )
            )

            // すでに同じ日時でスケジュールされている場合は更新不要
            if (subscription.cancel_at && subscription.cancel_at === normalizedCancelAt) {
              console.warn(`Subscription ${subscriptionId} is already scheduled to cancel at ${normalizedCancelAt}.`)
            } else if (subscription.cancel_at_period_end && normalizedCancelAt === currentPeriodEnd) {
              console.warn(`Subscription ${subscriptionId} is already set to cancel at period end ${currentPeriodEnd}.`)
            } else {
              if (subscription.cancel_at_period_end) {
                console.warn(
                  `Subscription ${subscriptionId} has cancel_at_period_end=true. Resetting before scheduling cancel_at ${normalizedCancelAt}.`
                )
                await stripe.subscriptions.update(subscriptionId, {
                  cancel_at_period_end: false,
                })
                subscription.cancel_at_period_end = false
              }

              await stripe.subscriptions.update(subscriptionId, {
                cancel_at: normalizedCancelAt,
                proration_behavior: 'none',
              })
            }

            const actualCancellationDate = new Date(normalizedCancelAt * 1000).toISOString().split('T')[0]
            if (actualCancellationDate !== cancellationDate) {
              effectiveCancellationDate = actualCancellationDate
              await supabase
                .from('user_plans')
                .update({
                  cancellation_scheduled_date: actualCancellationDate,
                })
                .eq('id', userPlanId)
            }
          }
        }
      } catch (stripeError: any) {
        console.error('Stripe subscription cancel error:', {
          message: stripeError?.message,
          code: stripeError?.code,
          type: stripeError?.type,
          docUrl: stripeError?.doc_url,
          requestId: stripeError?.requestId || stripeError?.raw?.requestId,
          raw: stripeError?.raw,
        })
        // サブスクリプションが既にキャンセル済み／存在しないなどの場合はエラーにせず進める
        // Stripeエラーコード参考: https://stripe.com/docs/error-codes
        if (stripeError?.code === 'resource_missing' || stripeError?.message?.includes('No such subscription')) {
          console.warn(
            `Subscription ${currentPlan.stripe_subscription_id} is already canceled or missing. Continuing.`
          )
        } else {
          return NextResponse.json(
            {
              error: 'Stripeサブスクリプションの解約に失敗しました',
              details: stripeError?.message,
              code: stripeError?.code,
            },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '退会申請が完了しました',
      cancellationDate: effectiveCancellationDate,
      cancellationFee: cancellationFee || 0,
    })
  } catch (error: any) {
    console.error('Cancellation API error:', error)
    return NextResponse.json(
      { error: error.message || '退会申請に失敗しました' },
      { status: 500 }
    )
  }
}

async function chargeCancellationFee({
  stripe,
  supabase,
  userId,
  userPlanId,
  amount,
}: {
  stripe: Stripe
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  userPlanId: string
  amount: number
}): Promise<{ success: true; paymentIntentId?: string } | { success: false; error: string; code?: string }> {
  if (amount <= 0) {
    return { success: true }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (userError || !userData?.stripe_customer_id) {
    return {
      success: false,
      error: 'Stripe顧客情報が見つかりません',
      code: 'missing_customer',
    }
  }

  const customerId = userData.stripe_customer_id

  const customer = await stripe.customers.retrieve(customerId)
  if ('deleted' in customer && customer.deleted) {
    return {
      success: false,
      error: 'Stripe顧客情報が無効です',
      code: 'missing_customer',
    }
  }

  let defaultPaymentMethodId = typeof customer.invoice_settings?.default_payment_method === 'string'
    ? customer.invoice_settings.default_payment_method
    : null

  if (!defaultPaymentMethodId) {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    })
    if (paymentMethods.data.length > 0) {
      defaultPaymentMethodId = paymentMethods.data[0].id
    }
  }

  if (!defaultPaymentMethodId) {
    return {
      success: false,
      error: 'カード情報が登録されていません',
      code: 'no_payment_method',
    }
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'jpy',
      customer: customerId,
      payment_method: defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        user_id: userId,
        user_plan_id: userPlanId,
        type: 'plan_cancellation_fee',
      },
    })

    await supabase
      .from('user_plans')
      .update({
        cancellation_fee_paid: true,
      })
      .eq('id', userPlanId)

    await Promise.all([
      cache.delete(cacheKey('user_plan', userId)),
      cache.delete(cacheKey('user_plans_full', userId)),
    ])

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error: any) {
    console.error('Cancellation fee payment error:', error)

    let errorCode: string | undefined
    let errorMessage = '解約料金の決済に失敗しました'
    if (error?.code) {
      errorCode = error.code
    }
    if (error?.message) {
      errorMessage = error.message
    }

    return {
      success: false,
      error: errorMessage,
      code: errorCode,
    }
  }
}

