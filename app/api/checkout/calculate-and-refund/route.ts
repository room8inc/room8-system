import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'

/**
 * ドロップイン会員のチェックアウト時の料金計算と決済処理
 * 実際の利用時間に応じた料金を計算し、決済を実行する
 * 決済失敗時は未決済として記録（後日支払い可能）
 */
export async function POST(request: NextRequest) {
  try {
    const stripeMode = await getStripeMode()
    const stripe = getStripeClient(stripeMode)
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
      .select('id, user_id, checkin_at, checkout_at, duration_minutes, member_type_at_checkin, payment_status, dropin_fee')
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

    // チェックアウトされていない場合はエラー
    if (!checkin.checkout_at || !checkin.duration_minutes) {
      return NextResponse.json({ error: 'チェックアウトが完了していません' }, { status: 400 })
    }

    // 既に決済済みの場合はエラー
    if (checkin.payment_status === 'paid') {
      return NextResponse.json({ error: '既に決済済みです' }, { status: 400 })
    }

    // 料金計算（1時間400円、最大2,000円）
    const HOURLY_RATE = 400 // 1時間あたりの料金（円）
    const MAX_FEE = 2000 // 最大料金（円）

    const durationHours = Math.ceil(checkin.duration_minutes / 60) // 切り上げ
    const actualFee = Math.min(durationHours * HOURLY_RATE, MAX_FEE)

    // ユーザー情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, name, company_name, is_individual')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    // Stripe Customer IDが存在しない場合はエラー（本来はチェックイン時に確認済み）
    if (!customerId) {
      return NextResponse.json({ error: 'Stripe顧客情報が見つかりません' }, { status: 400 })
    }

    // Stripe CustomerのPayment Methodを確認
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    // デフォルトのPayment Methodを取得
    let defaultPaymentMethodId: string | null = null

    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
      defaultPaymentMethodId = customer.invoice_settings.default_payment_method as string
    } else if (paymentMethods.data.length > 0) {
      defaultPaymentMethodId = paymentMethods.data[0].id
    }

    // Payment Methodが登録されていない場合はエラー
    if (!defaultPaymentMethodId) {
      // 未決済として記録（料金は計算済み）
      await supabase
        .from('checkins')
        .update({
          dropin_fee: actualFee,
          payment_status: 'pending',
        })
        .eq('id', checkinId)

      return NextResponse.json({
        success: false,
        error: 'カード情報が登録されていません',
        actualFee,
        paymentStatus: 'pending',
      })
    }

    // 料金が0円の場合は決済不要
    if (actualFee === 0) {
      await supabase
        .from('checkins')
        .update({
          dropin_fee: 0,
          payment_status: 'paid',
          payment_date: new Date().toISOString(),
        })
        .eq('id', checkinId)

      return NextResponse.json({
        success: true,
        actualFee: 0,
        message: '料金は0円のため決済不要です',
      })
    }

    // 実際の料金を決済
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: actualFee,
        currency: 'jpy',
        customer: customerId,
        payment_method: defaultPaymentMethodId,
        off_session: true, // オフセッション決済
        confirm: true, // 即座に決済を確定
        metadata: {
          user_id: user.id,
          checkin_id: checkinId,
          type: 'dropin_checkout',
        },
      })

      // 決済成功
      await supabase
        .from('checkins')
        .update({
          dropin_fee: actualFee,
          stripe_payment_intent_id: paymentIntent.id,
          payment_status: 'paid',
          payment_date: new Date().toISOString(),
        })
        .eq('id', checkinId)

      return NextResponse.json({
        success: true,
        actualFee,
        paymentIntentId: paymentIntent.id,
        message: `決済完了: ${actualFee}円`,
      })
    } catch (paymentError: any) {
      // 決済失敗（残高不足など）
      console.error('Payment error:', paymentError)

      // 未決済として記録
      await supabase
        .from('checkins')
        .update({
          dropin_fee: actualFee,
          payment_status: 'pending',
        })
        .eq('id', checkinId)

      // エラーメッセージを返す
      let errorMessage = '決済に失敗しました'
      if (paymentError.code === 'card_declined') {
        errorMessage = 'カードが拒否されました。残高不足の可能性があります。後日支払いが可能です。'
      } else if (paymentError.code === 'insufficient_funds') {
        errorMessage = '残高不足です。後日支払いが可能です。'
      } else if (paymentError.message) {
        errorMessage = paymentError.message
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        actualFee,
        paymentStatus: 'pending',
      })
    }
  } catch (error: any) {
    console.error('Drop-in checkout payment error:', error)
    return NextResponse.json(
      { error: error.message || '料金計算に失敗しました' },
      { status: 500 }
    )
  }
}

