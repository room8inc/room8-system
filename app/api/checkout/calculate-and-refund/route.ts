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
 * ドロップイン会員のチェックアウト時の料金計算と返金処理
 * 実際の利用時間に応じた料金を計算し、差額を返金する
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
      .select('id, user_id, checkin_at, checkout_at, duration_minutes, member_type_at_checkin, stripe_payment_intent_id, payment_status, dropin_fee')
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

    // 既に返金済みの場合はエラー
    if (checkin.payment_status === 'refunded') {
      return NextResponse.json({ error: '既に返金処理が完了しています' }, { status: 400 })
    }

    // Payment Intent IDが存在しない場合はエラー
    if (!checkin.stripe_payment_intent_id) {
      return NextResponse.json({ error: '決済情報が見つかりません' }, { status: 400 })
    }

    // 料金計算（1時間400円、最大2,000円）
    const HOURLY_RATE = 400 // 1時間あたりの料金（円）
    const MAX_FEE = 2000 // 最大料金（円）

    const durationHours = Math.ceil(checkin.duration_minutes / 60) // 切り上げ
    const actualFee = Math.min(durationHours * HOURLY_RATE, MAX_FEE)

    // 既に決済済みの金額（最大2,000円）
    const paidAmount = checkin.dropin_fee || MAX_FEE

    // 返金額を計算
    const refundAmount = paidAmount - actualFee

    // Payment Intentを取得
    const paymentIntent = await stripe.paymentIntents.retrieve(checkin.stripe_payment_intent_id)

    // 返金処理（差額がある場合のみ）
    if (refundAmount > 0) {
      // Refundを作成
      const refund = await stripe.refunds.create({
        payment_intent: checkin.stripe_payment_intent_id,
        amount: refundAmount,
        metadata: {
          user_id: user.id,
          checkin_id: checkinId,
          type: 'dropin_checkout',
          actual_fee: actualFee.toString(),
          refund_amount: refundAmount.toString(),
        },
      })

      // checkinsテーブルを更新
      await supabase
        .from('checkins')
        .update({
          dropin_fee: actualFee,
          refund_amount: refundAmount,
          payment_status: 'refunded',
        })
        .eq('id', checkinId)

      return NextResponse.json({
        success: true,
        actualFee,
        refundAmount,
        refundId: refund.id,
        message: `料金計算完了: ${actualFee}円（返金: ${refundAmount}円）`,
      })
    } else {
      // 返金不要（最大料金まで利用した場合）
      await supabase
        .from('checkins')
        .update({
          dropin_fee: actualFee,
          refund_amount: 0,
          payment_status: 'paid',
        })
        .eq('id', checkinId)

      return NextResponse.json({
        success: true,
        actualFee,
        refundAmount: 0,
        message: `料金計算完了: ${actualFee}円（返金なし）`,
      })
    }
  } catch (error: any) {
    console.error('Drop-in checkout calculation error:', error)
    return NextResponse.json(
      { error: error.message || '料金計算に失敗しました' },
      { status: 500 }
    )
  }
}

