import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

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
 * 退会申請API
 * 
 * 15日までに申請すれば翌月1日から適用
 * 長期契約割引（年契約）の場合は解約料金が必要
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { userPlanId, cancellationDate, cancellationFee } = body

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
    const isImmediateCancellation = cancellationDateObj.getTime() <= now.getTime()

    // 解約予定日を設定
    // 解約料金がある場合は、支払い済みフラグをfalseに設定
    if (isImmediateCancellation) {
      const todayStr = now.toISOString().split('T')[0]
      const { error: immediateUpdateError } = await supabase
        .from('user_plans')
        .update({
          status: 'cancelled',
          ended_at: todayStr,
          cancellation_scheduled_date: cancellationDate,
          cancellation_fee: cancellationFee || 0,
          cancellation_fee_paid: cancellationFee === 0 || !cancellationFee,
        })
        .eq('id', userPlanId)

      if (immediateUpdateError) {
        console.error('Immediate cancellation update error:', immediateUpdateError)
        return NextResponse.json(
          { error: '退会情報の更新に失敗しました' },
          { status: 500 }
        )
      }

      // ユーザーの会員区分をドロップインに戻す
      await supabase
        .from('users')
        .update({ member_type: 'dropin' })
        .eq('id', user.id)
    } else {
      const { error: updateError } = await supabase
        .from('user_plans')
        .update({
          cancellation_scheduled_date: cancellationDate,
          cancellation_fee: cancellationFee || 0,
          cancellation_fee_paid: cancellationFee === 0 || !cancellationFee,
        })
        .eq('id', userPlanId)

      if (updateError) {
        console.error('Cancellation update error:', updateError)
        return NextResponse.json(
          { error: '退会申請の更新に失敗しました' },
          { status: 500 }
        )
      }
    }

    // Stripeサブスクリプションを更新
    if (currentPlan.stripe_subscription_id) {
      try {
        const stripe = getStripeClient()
        const subscriptionId = currentPlan.stripe_subscription_id

        if (isImmediateCancellation) {
          // 即時解約
          await stripe.subscriptions.cancel(subscriptionId, {
            invoice_now: false,
            prorate: false,
          })
        } else {
          // 指定日に解約
          const cancelAt = Math.floor(cancellationDateObj.getTime() / 1000)
          await stripe.subscriptions.update(subscriptionId, {
            cancel_at: cancelAt,
            cancel_at_period_end: false,
            proration_behavior: 'none',
          })
        }
      } catch (stripeError: any) {
        console.error('Stripe subscription cancel error:', stripeError)
        return NextResponse.json(
          { error: 'Stripeサブスクリプションの解約に失敗しました' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: '退会申請が完了しました',
      cancellationDate,
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

