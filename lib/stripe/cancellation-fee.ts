import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'
import type { StripeMode } from '@/lib/stripe/mode'

/**
 * Stripe クライアント取得
 * @param mode - 'live' | 'test' を指定。省略時は環境変数の優先順位で決定（後方互換）
 */
export function getStripeClient(mode?: StripeMode): Stripe {
  let stripeSecretKey: string | undefined

  if (mode === 'live') {
    stripeSecretKey = process.env.STRIPE_SECRET_KEY
  } else if (mode === 'test') {
    stripeSecretKey = process.env.STRIPE_SECRET_KEY_TEST
  } else {
    stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY_TEST
  }

  if (!stripeSecretKey) {
    throw new Error(`Stripeの${mode || ''}シークレットキーが設定されていません`)
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
  })
}

interface ChargeParams {
  stripe: Stripe
  supabase: SupabaseClient
  userId: string
  userPlanId: string
  amount: number
}

export async function chargeCancellationFee({
  stripe,
  supabase,
  userId,
  userPlanId,
  amount,
}: ChargeParams): Promise<{ success: true; paymentIntentId?: string } | { success: false; error: string; code?: string }> {
  if (amount <= 0) {
    return { success: true }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

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

  let defaultPaymentMethodId =
    typeof customer.invoice_settings?.default_payment_method === 'string'
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
