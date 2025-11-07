import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY_TEST
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY_TEST環境変数が設定されていません')
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-10-29.clover',
  })
}

/**
 * ユーザーの登録済みPayment Methodを確認
 */
export async function GET(request: NextRequest) {
  try {
    const stripe = getStripeClient()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // Stripe Customer IDを取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!userData?.stripe_customer_id) {
      return NextResponse.json({
        hasPaymentMethod: false,
        paymentMethod: null,
      })
    }

    // Stripe CustomerのPayment Methodを確認
    const paymentMethods = await stripe.paymentMethods.list({
      customer: userData.stripe_customer_id,
      type: 'card',
    })

    // デフォルトのPayment Methodを取得
    let defaultPaymentMethodId: string | null = null
    let paymentMethod: any = null

    const customer = await stripe.customers.retrieve(userData.stripe_customer_id)
    if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
      defaultPaymentMethodId = customer.invoice_settings.default_payment_method as string
    } else if (paymentMethods.data.length > 0) {
      defaultPaymentMethodId = paymentMethods.data[0].id
    }

    if (defaultPaymentMethodId) {
      // Payment Methodの詳細を取得
      paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId)
    }

    return NextResponse.json({
      hasPaymentMethod: !!defaultPaymentMethodId,
      paymentMethod: paymentMethod
        ? {
            id: paymentMethod.id,
            card: paymentMethod.card
              ? {
                  brand: paymentMethod.card.brand,
                  last4: paymentMethod.card.last4,
                  exp_month: paymentMethod.card.exp_month,
                  exp_year: paymentMethod.card.exp_year,
                }
              : null,
          }
        : null,
    })
  } catch (error: any) {
    console.error('Payment method check error:', error)
    return NextResponse.json(
      { error: error.message || 'カード情報の確認に失敗しました' },
      { status: 500 }
    )
  }
}

