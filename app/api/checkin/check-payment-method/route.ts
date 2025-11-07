import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY_TEST
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY_TEST環境変数が設定されていません')
  }
  return new Stripe(stripeSecretKey, { apiVersion: '2025-10-29.clover' })
}

/**
 * ドロップイン会員のクレジットカード登録状況を確認
 * 未決済のチェックアウトがあるかも確認
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

    // ユーザー情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, member_type')
      .eq('id', user.id)
      .single()

    // プラン契約があるかチェック
    const { data: activePlan } = await supabase
      .from('user_plans')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single()

    const memberType = activePlan ? 'regular' : (userData?.member_type || 'dropin')

    // ドロップイン会員でない場合はスキップ
    if (memberType !== 'dropin') {
      return NextResponse.json({
        hasPaymentMethod: true,
        hasUnpaidCheckouts: false,
      })
    }

    // 未決済のチェックアウトがあるか確認
    const { data: unpaidCheckouts } = await supabase
      .from('checkins')
      .select('id')
      .eq('user_id', user.id)
      .eq('member_type_at_checkin', 'dropin')
      .not('checkout_at', 'is', null)
      .eq('payment_status', 'pending')
      .limit(1)

    const hasUnpaidCheckouts = (unpaidCheckouts?.length || 0) > 0

    // Stripe Customer IDを確認
    let customerId = userData?.stripe_customer_id
    let hasPaymentMethod = false

    if (customerId) {
      try {
        // Stripe CustomerのPayment Methodを確認
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        })

        // デフォルトのPayment Methodを取得
        const customer = await stripe.customers.retrieve(customerId)
        if (!customer.deleted) {
          if (customer.invoice_settings?.default_payment_method) {
            hasPaymentMethod = true
          } else if (paymentMethods.data.length > 0) {
            hasPaymentMethod = true
          }
        }
      } catch (error) {
        // Stripe Customerが存在しない場合は、カード未登録として扱う
        console.error('Stripe customer check error:', error)
      }
    }

    return NextResponse.json({
      hasPaymentMethod,
      hasUnpaidCheckouts,
    })
  } catch (error: any) {
    console.error('Payment method check error:', error)
    return NextResponse.json(
      { error: error.message || 'カード情報の確認に失敗しました' },
      { status: 500 }
    )
  }
}

