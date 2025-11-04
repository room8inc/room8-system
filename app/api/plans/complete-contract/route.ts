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
      paymentIntentId,
    } = body

    // Payment Intentを確認
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method'],
    })

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: '決済が完了していません' }, { status: 400 })
    }

    // Payment Intentから顧客IDを取得（確実に存在する）
    const customerIdFromIntent = typeof paymentIntent.customer === 'string' 
      ? paymentIntent.customer 
      : paymentIntent.customer?.id

    if (!customerIdFromIntent) {
      return NextResponse.json({ error: '顧客情報が見つかりません' }, { status: 400 })
    }

    // ユーザー情報を取得（顧客名のため）
    const { data: userDataForName } = await supabase
      .from('users')
      .select('name, company_name, is_individual')
      .eq('id', user.id)
      .single()

    // 顧客IDがStripeに存在するか確認し、存在しない場合は再作成
    let customerId = customerIdFromIntent
    try {
      await stripe.customers.retrieve(customerIdFromIntent)
      console.log(`Customer ${customerIdFromIntent} exists in Stripe`)
    } catch (error: any) {
      // 顧客が存在しない場合は再作成
      console.error(`Customer ${customerIdFromIntent} not found in Stripe:`, error.message, error.code)
      console.log(`Creating new customer for user ${user.id}`)
      
      // 顧客名を決定（個人の場合はname、法人の場合はcompany_name）
      // nameは「姓 名」の順で保存されているが、念のためformatJapaneseNameを使用
      const { formatJapaneseName } = await import('@/lib/utils/name')
      const customerName = userDataForName?.is_individual === false && userDataForName?.company_name
        ? userDataForName.company_name
        : formatJapaneseName(userDataForName?.name) || user.email || undefined
      
      const newCustomer = await stripe.customers.create({
        email: user.email || undefined,
        name: customerName,
        metadata: {
          user_id: user.id,
          is_individual: userDataForName?.is_individual ? 'true' : 'false',
        },
      })
      customerId = newCustomer.id
      console.log(`Created new customer: ${customerId} (name: ${customerName})`)
      
      // データベースに保存
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // 重複チェック：同じPayment Intent IDで既に契約が作成されていないか確認
    const { data: existingContract } = await supabase
      .from('user_plans')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    if (existingContract) {
      return NextResponse.json({ error: 'この決済は既に処理済みです' }, { status: 400 })
    }

    // Payment Method IDを取得
    const paymentMethodId = typeof paymentIntent.payment_method === 'string' 
      ? paymentIntent.payment_method 
      : paymentIntent.payment_method?.id

    if (!paymentMethodId) {
      return NextResponse.json({ error: '支払い方法が見つかりません' }, { status: 400 })
    }

    // Payment Methodが顧客にアタッチされているか確認し、必要に応じてアタッチ
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
      if (paymentMethod.customer !== customerId) {
        console.log(`Attaching payment method ${paymentMethodId} to customer ${customerId}`)
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        })
        console.log(`Payment method attached successfully`)
      }
    } catch (error: any) {
      console.error('Payment method attachment error:', error.message, error.code)
      // エラーが発生しても続行（既にアタッチされている場合もある）
    }

    // プラン情報を取得
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'プラン情報の取得に失敗しました' }, { status: 400 })
    }

    // 既存のアクティブな契約をチェック
    const { data: existingPlan } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .maybeSingle()

    // 既存の契約がある場合は終了日を設定（プラン変更）
    if (existingPlan) {
      await supabase
        .from('user_plans')
        .update({
          ended_at: startDate,
          status: 'changed',
        })
        .eq('id', existingPlan.id)
    }

    // ロッカーが選択されている場合、利用可能なロッカーを割り当て
    let assignedLockerId: string | null = null
    if (options.locker && options.locker_size) {
      const { data: availableLocker } = await supabase
        .from('lockers')
        .select('id')
        .eq('size', options.locker_size)
        .eq('status', 'available')
        .limit(1)
        .single()

      if (availableLocker) {
        assignedLockerId = availableLocker.id
      }
    }

    // オプション情報を整理
    const selectedOptions: any = {}
    if (options.company_registration) selectedOptions.company_registration = true
    if (options.printer) selectedOptions.printer = true
    if (options.twenty_four_hours) selectedOptions.twenty_four_hours = true
    if (options.fixed_seat) selectedOptions.fixed_seat = true
    if (options.locker && options.locker_size) {
      selectedOptions.locker = true
      selectedOptions.locker_size = options.locker_size
      if (assignedLockerId) {
        selectedOptions.locker_id = assignedLockerId
      }
    }

    // キャンペーン情報を取得
    let entryFee = 11000
    let entryFeeDiscount = 0
    let firstMonthFree = false

    if (campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaign) {
        switch (campaign.campaign_type) {
          case 'entry_fee_free':
            entryFee = 0
            entryFeeDiscount = 11000
            break
          case 'entry_fee_50off':
            entryFee = Math.floor(11000 * 0.5)
            entryFeeDiscount = 11000 - entryFee
            break
          case 'entry_fee_custom':
            const discountRate = campaign.discount_rate || 0
            entryFee = Math.floor(11000 * (1 - discountRate / 100))
            entryFeeDiscount = 11000 - entryFee
            break
          case 'first_month_free':
            firstMonthFree = true
            break
        }
      }
    }

    // 契約を作成
    const { data: userPlan, error: insertError } = await supabase
      .from('user_plans')
      .insert({
        user_id: user.id,
        plan_id: planId,
        started_at: startDate,
        status: 'active',
        contract_term: contractTerm,
        payment_method: paymentMethod,
        options: selectedOptions,
        campaign_id: campaignId,
        entry_fee: 11000,
        entry_fee_discount: entryFeeDiscount,
        first_month_free: firstMonthFree,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Contract insert error:', insertError)
      return NextResponse.json({ error: '契約の作成に失敗しました' }, { status: 500 })
    }

    // ロッカーを割り当て
    if (assignedLockerId) {
      await supabase
        .from('lockers')
        .update({
          user_id: user.id,
          status: 'occupied',
        })
        .eq('id', assignedLockerId)
    }

    // member_typeを'regular'に更新
    await supabase
      .from('users')
      .update({
        member_type: 'regular',
      })
      .eq('id', user.id)

    // Subscriptionを作成（2ヶ月目以降の自動決済用）
    // Payment Intentから取得した顧客IDを使用（確実に存在する）
    if (customerId) {
      // PriceIDを取得
      let priceId: string | null = null
      if (contractTerm === 'yearly') {
        priceId = plan.stripe_price_id_yearly
      } else if (paymentMethod === 'annual_prepaid') {
        priceId = plan.stripe_price_id_annual_prepaid
      } else {
        priceId = plan.stripe_price_id_monthly
      }

      if (priceId) {
        // 開始日を翌月1日に設定
        const startDateObj = new Date(startDate)
        const nextMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 1)
        const subscriptionStartDate = Math.floor(nextMonth.getTime() / 1000)

        // Subscriptionを作成（初回支払いは発生しないように設定）
        console.log(`Creating subscription for customer ${customerId} with price ${priceId}`)
        console.log(`Subscription start date: ${new Date(subscriptionStartDate * 1000).toISOString()}`)
        let subscription
        try {
          subscription = await stripe.subscriptions.create({
            customer: customerId, // Payment Intentから取得した顧客IDを使用
            default_payment_method: paymentMethodId, // Payment Methodを指定
            items: [
              {
                price: priceId,
              },
            ],
            billing_cycle_anchor: subscriptionStartDate,
            // trial_endは削除（初回支払いは既に完了しているため、トライアルは不要）
            // billing_cycle_anchorのみで次回請求日を設定
            proration_behavior: 'none', // 初回支払い時の比例計算を無効化
            metadata: {
              user_id: user.id,
              user_plan_id: userPlan.id,
              plan_id: planId,
            },
          })
          console.log(`Subscription created: ${subscription.id}`)
        } catch (subscriptionError: any) {
          console.error('Subscription creation error:', subscriptionError.message, subscriptionError.code)
          console.error('Customer ID:', customerId)
          console.error('Payment Method ID:', paymentMethodId)
          throw subscriptionError
        }

        // Subscription IDを保存
        await supabase
          .from('user_plans')
          .update({ stripe_subscription_id: subscription.id })
          .eq('id', userPlan.id)

        // オプションのPriceIDを追加
        const optionPriceIds: string[] = []
        if (options.company_registration) {
          const { data: optionPrice } = await supabase
            .from('plan_options_stripe_prices')
            .select('stripe_price_id')
            .eq('option_code', 'company_registration')
            .single()
          if (optionPrice?.stripe_price_id) {
            optionPriceIds.push(optionPrice.stripe_price_id)
          }
        }
        if (options.printer) {
          const { data: optionPrice } = await supabase
            .from('plan_options_stripe_prices')
            .select('stripe_price_id')
            .eq('option_code', 'printer')
            .single()
          if (optionPrice?.stripe_price_id) {
            optionPriceIds.push(optionPrice.stripe_price_id)
          }
        }
        if (options.twenty_four_hours) {
          const { data: optionPrice } = await supabase
            .from('plan_options_stripe_prices')
            .select('stripe_price_id')
            .eq('option_code', 'twenty_four_hours')
            .single()
          if (optionPrice?.stripe_price_id) {
            optionPriceIds.push(optionPrice.stripe_price_id)
          }
        }
        if (options.fixed_seat) {
          // 固定席化はオプションPriceIDがない場合もあるので、後で追加
        }
        if (options.locker && options.locker_size) {
          const { data: optionPrice } = await supabase
            .from('plan_options_stripe_prices')
            .select('stripe_price_id')
            .eq('option_code', options.locker_size === 'large' ? 'locker_large' : 'locker_small')
            .single()
          if (optionPrice?.stripe_price_id) {
            optionPriceIds.push(optionPrice.stripe_price_id)
          }
        }

        // オプションのPriceIDをSubscriptionに追加
        if (optionPriceIds.length > 0) {
          await stripe.subscriptions.update(subscription.id, {
            items: [
              ...subscription.items.data.map((item) => ({
                id: item.id,
                price: item.price.id,
              })),
              ...optionPriceIds.map((priceId) => ({
                price: priceId,
              })),
            ],
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Contract completion error:', error)
    return NextResponse.json(
      { error: error.message || '契約の確定に失敗しました' },
      { status: 500 }
    )
  }
}

