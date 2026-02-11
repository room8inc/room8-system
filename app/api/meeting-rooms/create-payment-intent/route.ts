import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'

export const runtime = 'nodejs'

/**
 * 会議室予約用のPayment Intentを作成（非会員用）
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
    const {
      bookingId,
      amount, // 決済金額（円）
      billingUserId, // 決済を行うユーザーID
    } = body

    if (!bookingId || !amount || !billingUserId) {
      return NextResponse.json(
        { error: '予約ID、金額、決済ユーザーIDが必要です' },
        { status: 400 }
      )
    }

    // 予約情報を確認
    const { data: booking, error: bookingError } = await supabase
      .from('meeting_room_bookings')
      .select('id, billing_user_id, total_amount, member_type_at_booking, payment_status')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: '予約情報の取得に失敗しました' }, { status: 400 })
    }

    // 決済ユーザーIDが一致するか確認
    if (booking.billing_user_id !== billingUserId) {
      return NextResponse.json({ error: '決済権限がありません' }, { status: 403 })
    }

    // 金額が一致するか確認
    if (booking.total_amount !== amount) {
      return NextResponse.json({ error: '金額が一致しません' }, { status: 400 })
    }

    // 既に決済済みの場合はエラー
    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: '既に決済済みです' }, { status: 400 })
    }

    // Stripe Customerを作成または取得
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, name, company_name, is_individual')
      .eq('id', billingUserId)
      .single()

    let customerId = userData?.stripe_customer_id

    // 顧客IDが存在する場合、Stripeで確認
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId)
        console.log(`Customer ${customerId} exists in Stripe`)
      } catch (error: any) {
        console.error(`Customer ${customerId} not found in Stripe:`, error.message, error.code)
        customerId = null
      }
    }

    // 顧客IDが存在しない場合は新規作成
    if (!customerId) {
      console.log(`Creating new customer for user ${billingUserId}`)
      
      const { formatJapaneseName } = await import('@/lib/utils/name')
      const customerName = userData?.is_individual === false && userData?.company_name
        ? userData.company_name
        : formatJapaneseName(userData?.name) || user.email || undefined

      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: customerName,
        metadata: {
          user_id: billingUserId,
          is_individual: userData?.is_individual ? 'true' : 'false',
        },
      })
      customerId = customer.id
      console.log(`Created new customer: ${customerId} (name: ${customerName})`)

      // データベースに保存
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', billingUserId)
    }

    // Payment Intentを作成
    console.log('Creating Payment Intent:', { amount, customerId, bookingId })
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'jpy',
      customer: customerId,
      metadata: {
        user_id: billingUserId,
        booking_id: bookingId,
        type: 'meeting_room_booking',
      },
    })

    console.log('Payment Intent created:', paymentIntent.id)

    // 予約情報を更新（Payment Intent IDを保存）
    const { error: updateError } = await supabase
      .from('meeting_room_bookings')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Failed to update booking with payment intent ID:', updateError)
    } else {
      console.log('Booking updated with payment intent ID')
    }

    console.log('=== Payment Intent Creation Completed ===')
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: any) {
    console.error('Payment Intent creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Payment Intentの作成に失敗しました' },
      { status: 500 }
    )
  }
}

