import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(stripeSecretKey, { apiVersion: '2025-10-29.clover' })
}

/**
 * ドロップイン会員のチェックイン時の事前決済用Payment Intentを作成
 * 最大料金（2,000円）を事前決済（オーソリ）して、デビットカードでも確実に決済できるようにする
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

    const body = await request.json()
    const { checkinId } = body

    if (!checkinId) {
      return NextResponse.json({ error: 'チェックインIDが必要です' }, { status: 400 })
    }

    // チェックイン情報を取得
    const { data: checkin, error: checkinError } = await supabase
      .from('checkins')
      .select('id, user_id, member_type_at_checkin, stripe_payment_intent_id, payment_status')
      .eq('id', checkinId)
      .single()

    if (checkinError || !checkin) {
      return NextResponse.json({ error: 'チェックイン情報の取得に失敗しました' }, { status: 400 })
    }

    // ユーザーIDが一致するか確認
    if (checkin.user_id !== user.id) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // ドロップイン会員でない場合はエラー
    if (checkin.member_type_at_checkin !== 'dropin') {
      return NextResponse.json({ error: 'ドロップイン会員のみが利用できます' }, { status: 400 })
    }

    // 既に決済済みの場合はエラー
    if (checkin.payment_status === 'paid' || checkin.stripe_payment_intent_id) {
      return NextResponse.json({ error: '既に決済済みです' }, { status: 400 })
    }

    // ユーザー情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, name, company_name, is_individual')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    // Stripe Customer IDが存在しない場合は新規作成
    if (!customerId) {
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

      // データベースに保存
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Stripe CustomerのPayment Methodを確認
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    // デフォルトのPayment Methodを取得
    let defaultPaymentMethodId: string | null = null

    // 顧客のデフォルトPayment Methodをチェック
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
      defaultPaymentMethodId = customer.invoice_settings.default_payment_method as string
    } else if (paymentMethods.data.length > 0) {
      // デフォルトがなければ、最初のPayment Methodを使用
      defaultPaymentMethodId = paymentMethods.data[0].id
    }

    // Payment Methodが登録されていない場合はエラー
    if (!defaultPaymentMethodId) {
      return NextResponse.json(
        { error: 'カード情報が登録されていません。プロフィール画面でカード情報を登録してください。' },
        { status: 400 }
      )
    }

    // 最大料金（2,000円）のPayment Intentを作成
    const MAX_DROPIN_FEE = 2000 // 最大料金（円）

    const paymentIntent = await stripe.paymentIntents.create({
      amount: MAX_DROPIN_FEE,
      currency: 'jpy',
      customer: customerId,
      payment_method: defaultPaymentMethodId,
      off_session: true, // オフセッション決済（カード情報入力不要）
      confirm: true, // 即座に決済を確定
      metadata: {
        user_id: user.id,
        checkin_id: checkinId,
        type: 'dropin_checkin',
      },
    })

    // Payment Intent IDをcheckinsテーブルに保存
    await supabase
      .from('checkins')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'paid',
        payment_date: new Date().toISOString(),
        dropin_fee: MAX_DROPIN_FEE, // 一旦最大料金を保存（チェックアウト時に実際の料金に更新）
      })
      .eq('id', checkinId)

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      amount: MAX_DROPIN_FEE,
    })
  } catch (error: any) {
    console.error('Drop-in payment intent creation error:', error)
    return NextResponse.json(
      { error: error.message || '決済の準備に失敗しました' },
      { status: 500 }
    )
  }
}

