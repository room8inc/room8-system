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

    const body = await request.json()
    const {
      planId,
      contractTerm,
      paymentMethod,
      options,
      startDate,
      campaignId,
      entryFee,
      firstMonthFee,
      optionPrice,
      totalPrice,
    } = body

    // プラン情報を取得
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'プラン情報の取得に失敗しました' }, { status: 400 })
    }

    // Stripe Customerを作成または取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, name, company_name, is_individual')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    // 顧客IDが存在する場合、Stripeで確認
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId)
        console.log(`Customer ${customerId} exists in Stripe`)
      } catch (error: any) {
        console.error(`Customer ${customerId} not found in Stripe:`, error.message, error.code)
        // 顧客が存在しない場合は新規作成
        customerId = null
      }
    }

    // 顧客IDが存在しない場合は新規作成
    if (!customerId) {
      console.log(`Creating new customer for user ${user.id}`)
      
      // 顧客名を決定（個人の場合はname、法人の場合はcompany_name）
      // nameは「姓 名」の順で保存されているが、念のためformatJapaneseNameを使用
      const { formatJapaneseName } = await import('@/lib/utils/name')
      const customerName = userData?.is_individual === false && userData?.company_name
        ? userData.company_name
        : formatJapaneseName(userData?.name) || user.email || undefined

      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: customerName,
        metadata: {
          user_id: user.id,
          is_individual: userData?.is_individual ? 'true' : 'false',
        },
      })
      customerId = customer.id
      console.log(`Created new customer: ${customerId} (name: ${customerName})`)

      // データベースに保存
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Payment Intentを作成
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPrice,
      currency: 'jpy',
      customer: customerId,
      setup_future_usage: 'off_session', // Payment Methodを将来の使用のために保存
      metadata: {
        user_id: user.id,
        plan_id: planId,
        contract_term: contractTerm,
        payment_method: paymentMethod,
        start_date: startDate,
        campaign_id: campaignId || '',
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error: any) {
    console.error('Payment Intent creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Payment Intentの作成に失敗しました' },
      { status: 500 }
    )
  }
}

