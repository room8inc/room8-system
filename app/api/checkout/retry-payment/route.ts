import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'

/**
 * 未決済のチェックアウトを再決済
 * 複数の未決済を一度に決済可能
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
    const { checkinIds } = body // 複数のチェックインIDを配列で受け取る

    if (!checkinIds || !Array.isArray(checkinIds) || checkinIds.length === 0) {
      return NextResponse.json({ error: 'チェックインIDが必要です' }, { status: 400 })
    }

    // ユーザー情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = userData?.stripe_customer_id
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

    if (!defaultPaymentMethodId) {
      return NextResponse.json({ error: 'カード情報が登録されていません' }, { status: 400 })
    }

    // 各チェックアウトを決済
    const results = []
    for (const checkinId of checkinIds) {
      // チェックイン情報を取得
      const { data: checkin, error: checkinError } = await supabase
        .from('checkins')
        .select('id, user_id, dropin_fee, payment_status')
        .eq('id', checkinId)
        .single()

      if (checkinError || !checkin) {
        results.push({ checkinId, success: false, error: 'チェックイン情報が見つかりません' })
        continue
      }

      // ユーザーIDが一致するか確認
      if (checkin.user_id !== user.id) {
        results.push({ checkinId, success: false, error: '権限がありません' })
        continue
      }

      // 既に決済済みの場合はスキップ
      if (checkin.payment_status === 'paid') {
        results.push({ checkinId, success: false, error: '既に決済済みです' })
        continue
      }

      const amount = checkin.dropin_fee || 0
      if (amount === 0) {
        results.push({ checkinId, success: false, error: '料金が0円です' })
        continue
      }

      try {
        // 決済を実行
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'jpy',
          customer: customerId,
          payment_method: defaultPaymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            user_id: user.id,
            checkin_id: checkinId,
            type: 'dropin_retry_payment',
          },
        })

        // 決済成功
        await supabase
          .from('checkins')
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            payment_status: 'paid',
            payment_date: new Date().toISOString(),
          })
          .eq('id', checkinId)

        results.push({
          checkinId,
          success: true,
          amount,
          paymentIntentId: paymentIntent.id,
        })
      } catch (paymentError: any) {
        // 決済失敗
        console.error(`Payment error for checkin ${checkinId}:`, paymentError)
        results.push({
          checkinId,
          success: false,
          error: paymentError.message || '決済に失敗しました',
        })
      }
    }

    // 成功した決済の合計金額を計算
    const successfulPayments = results.filter(r => r.success)
    const totalAmount = successfulPayments.reduce((sum, r) => sum + (r.amount || 0), 0)

    return NextResponse.json({
      results,
      successCount: successfulPayments.length,
      failureCount: results.length - successfulPayments.length,
      totalAmount,
    })
  } catch (error: any) {
    console.error('Retry payment error:', error)
    return NextResponse.json(
      { error: error.message || '再決済に失敗しました' },
      { status: 500 }
    )
  }
}

