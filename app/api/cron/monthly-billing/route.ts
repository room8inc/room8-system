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
 * 会員向けの月末まとめ請求処理
 * Vercel Cronで毎月1日に実行される想定
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'

    if (cronSecret) {
      const expected = `Bearer ${cronSecret}`
      if (authHeader !== expected && !isVercelCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripeClient()
    const supabase = await createClient()

    // 前月の1日を取得（例：今日が2025-02-01なら、2025-01-01を取得）
    const now = new Date()
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const billingMonth = previousMonth.toISOString().split('T')[0]
    
    // 前月の開始日時と終了日時を取得
    const previousMonthStart = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1, 0, 0, 0)
    const previousMonthEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0, 23, 59, 59)

    console.log(`Processing monthly billing for ${billingMonth}`)

    // 前月分の未決済予約を取得（会員のみ）
    const { data: bookings, error: bookingsError } = await supabase
      .from('meeting_room_bookings')
      .select('id, billing_user_id, total_amount, member_type_at_booking, billing_month')
      .eq('billing_month', billingMonth)
      .eq('member_type_at_booking', 'regular')
      .eq('payment_status', 'pending')
      .in('status', ['reserved', 'confirmed', 'in_use', 'completed'])

    if (bookingsError) {
      console.error('Failed to fetch bookings:', bookingsError)
      return NextResponse.json({ error: '予約情報の取得に失敗しました' }, { status: 500 })
    }

    // 前月分の未決済時間外利用を取得（会員のみ）
    const { data: overtimeCheckins, error: overtimeError } = await supabase
      .from('checkins')
      .select('id, user_id, overtime_fee, checkout_at')
      .eq('member_type_at_checkin', 'regular')
      .eq('is_overtime', true)
      .not('checkout_at', 'is', null)
      .gte('checkout_at', previousMonthStart.toISOString())
      .lte('checkout_at', previousMonthEnd.toISOString())
      .is('overtime_fee_billed', null) // 未請求のもののみ

    if (overtimeError) {
      console.error('Failed to fetch overtime checkins:', overtimeError)
      return NextResponse.json({ error: '時間外利用情報の取得に失敗しました' }, { status: 500 })
    }

    // 会議室予約と時間外利用の両方がない場合は終了
    if ((!bookings || bookings.length === 0) && (!overtimeCheckins || overtimeCheckins.length === 0)) {
      console.log('No pending bookings or overtime checkins found for billing')
      return NextResponse.json({ 
        message: '請求対象がありません',
        billingMonth,
        bookingsCount: 0,
        overtimeCount: 0,
      })
    }

    // 決済ユーザーごとにグループ化（会議室予約）
    const bookingsByUser = new Map<string, typeof bookings>()
    for (const booking of bookings || []) {
      const userId = booking.billing_user_id
      if (!bookingsByUser.has(userId)) {
        bookingsByUser.set(userId, [])
      }
      bookingsByUser.get(userId)!.push(booking)
    }

    // 決済ユーザーごとにグループ化（時間外利用）
    const overtimeByUser = new Map<string, typeof overtimeCheckins>()
    for (const checkin of overtimeCheckins || []) {
      const userId = checkin.user_id
      if (!overtimeByUser.has(userId)) {
        overtimeByUser.set(userId, [])
      }
      overtimeByUser.get(userId)!.push(checkin)
    }

    // 全ユーザーIDを取得（会議室予約と時間外利用の両方）
    const allUserIds = new Set([
      ...Array.from(bookingsByUser.keys()),
      ...Array.from(overtimeByUser.keys()),
    ])

    const results = {
      billingMonth,
      totalUsers: allUserIds.size,
      totalBookings: bookings?.length || 0,
      totalOvertimeCheckins: overtimeCheckins?.length || 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // 各ユーザーに対して決済を実行
    for (const userId of allUserIds) {
      try {
        const userBookings = bookingsByUser.get(userId) || []
        const userOvertimeCheckins = overtimeByUser.get(userId) || []

        // 合計金額を計算（会議室予約 + 時間外利用）
        const bookingsAmount = userBookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0)
        const overtimeAmount = userOvertimeCheckins.reduce((sum, checkin) => sum + (checkin.overtime_fee || 0), 0)
        const totalAmount = bookingsAmount + overtimeAmount

        if (totalAmount === 0) {
          console.log(`Skipping user ${userId}: total amount is 0`)
          // 無料枠で全て利用した場合は決済状態を更新
          await supabase
            .from('meeting_room_bookings')
            .update({ payment_status: 'paid', payment_date: new Date().toISOString() })
            .in('id', userBookings.map(b => b.id))
          results.success++
          continue
        }

        // Stripe Customerを取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('stripe_customer_id, name, company_name, is_individual')
          .eq('id', userId)
          .single()

        if (userError || !userData) {
          const errorMsg = `ユーザー情報の取得に失敗しました: ${userId}`
          console.error(errorMsg, userError)
          results.errors.push(errorMsg)
          results.failed++
          continue
        }

        let customerId = userData.stripe_customer_id

        // Stripe Customer IDが存在しない場合は新規作成
        if (!customerId) {
          const { formatJapaneseName } = await import('@/lib/utils/name')
          const customerName = userData.is_individual === false && userData.company_name
            ? userData.company_name
            : formatJapaneseName(userData.name) || undefined

          const customer = await stripe.customers.create({
            name: customerName,
            metadata: {
              user_id: userId,
              is_individual: userData.is_individual ? 'true' : 'false',
            },
          })
          customerId = customer.id

          // データベースに保存
          await supabase
            .from('users')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId)
        }

        // Stripe CustomerのPayment Methodを確認
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        })

        // デフォルトのPayment Methodを取得（最初のカードまたは顧客のデフォルト）
        let defaultPaymentMethodId: string | null = null

        // 顧客のデフォルトPayment Methodをチェック
        const customer = await stripe.customers.retrieve(customerId)
        if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
          defaultPaymentMethodId = customer.invoice_settings.default_payment_method as string
        } else if (paymentMethods.data.length > 0) {
          // デフォルトがなければ、最初のPayment Methodを使用
          defaultPaymentMethodId = paymentMethods.data[0].id
        }

        // Payment Intentを作成
        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmount,
          currency: 'jpy',
          customer: customerId,
          metadata: {
            user_id: userId,
            type: 'monthly_billing',
            billing_month: billingMonth,
            booking_ids: userBookings.map(b => b.id).join(','),
            overtime_checkin_ids: userOvertimeCheckins.map(c => c.id).join(','),
            bookings_amount: bookingsAmount.toString(),
            overtime_amount: overtimeAmount.toString(),
          },
        })

        // Payment Methodが登録されている場合は決済を実行
        if (defaultPaymentMethodId) {
          try {
            // Payment Intentを確認して決済
            const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
              payment_method: defaultPaymentMethodId,
            })

            if (confirmedPaymentIntent.status === 'succeeded') {
              // 決済成功：予約の決済状態を更新
              if (userBookings.length > 0) {
                await supabase
                  .from('meeting_room_bookings')
                  .update({
                    payment_status: 'paid',
                    payment_date: new Date().toISOString(),
                    stripe_payment_intent_id: paymentIntent.id,
                  })
                  .in('id', userBookings.map(b => b.id))
              }

              // 決済成功：時間外利用の請求済みフラグを更新
              if (userOvertimeCheckins.length > 0) {
                await supabase
                  .from('checkins')
                  .update({
                    overtime_fee_billed: true,
                  })
                  .in('id', userOvertimeCheckins.map(c => c.id))
              }

              results.success++
              console.log(`Payment succeeded for user ${userId}: ${totalAmount} yen (bookings: ${bookingsAmount}, overtime: ${overtimeAmount})`)
            } else {
              // 決済失敗
              const errorMsg = `決済に失敗しました: ${userId} (Status: ${confirmedPaymentIntent.status})`
              results.errors.push(errorMsg)
              results.failed++
              console.error(errorMsg)
            }
          } catch (paymentError: any) {
            // 決済処理エラー
            const errorMsg = `決済処理に失敗しました: ${userId} - ${paymentError.message}`
            results.errors.push(errorMsg)
            results.failed++
            console.error(errorMsg, paymentError)
          }
        } else {
          // Payment Methodが登録されていない場合
          // ユーザーにクレジットカード登録を促す必要がある
          // 今回は、決済失敗として記録し、後で通知を送る
          const errorMsg = `支払い方法が登録されていません: ${userId}`
          results.errors.push(errorMsg)
          results.failed++
          console.error(errorMsg)
          
          // 予約の決済状態はpendingのまま（ユーザーにクレジットカード登録を促す）
          // ダッシュボードに警告を表示するロジックは別途実装が必要
        }
      } catch (err: any) {
        const errorMsg = `ユーザー ${userId} の決済処理に失敗しました: ${err.message}`
        console.error(errorMsg, err)
        results.errors.push(errorMsg)
        results.failed++
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Monthly billing error:', error)
    return NextResponse.json(
      { error: error.message || '月末まとめ請求処理に失敗しました' },
      { status: 500 }
    )
  }
}

