import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

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
 * クレジットカード登録用のSetup Intentを作成
 * Payment Methodが登録されていない場合に使用
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Stripe顧客が見つかりません' }, { status: 400 })
    }

    // Setup Intentを作成（クレジットカード登録用）
    const setupIntent = await stripe.setupIntents.create({
      customer: userData.stripe_customer_id,
      payment_method_types: ['card'],
      metadata: {
        user_id: user.id,
        type: 'card_registration',
      },
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    })
  } catch (error: any) {
    console.error('Setup Intent creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Setup Intentの作成に失敗しました' },
      { status: 500 }
    )
  }
}

