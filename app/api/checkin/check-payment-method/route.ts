import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'

/**
 * ドロップイン会員のクレジットカード登録状況を確認
 * 未決済のチェックアウトがあるかも確認
 */
export async function GET(request: NextRequest) {
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

    // ユーザー情報を取得
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, is_staff')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('User data fetch error:', userError)
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました' },
        { status: 500 }
      )
    }

    // プラン契約があるかチェック
    let planOwnerUserId = user.id
    if (userData?.is_staff === true) {
      const { data: staffMember, error: staffError } = await supabase
        .from('staff_members')
        .select('company_user_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (staffError && staffError.code !== 'PGRST116') {
        console.warn('Staff member fetch warning:', staffError)
      } else if (staffMember?.company_user_id) {
        planOwnerUserId = staffMember.company_user_id
      }
    }

    const { data: activePlan, error: activePlanError } = await supabase
      .from('user_plans')
      .select('plan_id')
      .eq('user_id', planOwnerUserId)
      .eq('status', 'active')
      .is('ended_at', null)
      .maybeSingle()

    if (activePlanError && activePlanError.code !== 'PGRST116') {
      console.warn('Active plan fetch warning:', activePlanError)
    }

    const isRegularMember = !!activePlan?.plan_id

    // ドロップイン会員でない場合はスキップ
    if (isRegularMember) {
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

