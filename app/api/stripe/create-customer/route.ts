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

    // ユーザー情報を取得
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, name, company_name, is_individual')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'ユーザー情報の取得に失敗しました' }, { status: 400 })
    }

    // 既にStripe顧客IDが存在する場合、Stripeで確認
    if (userData.stripe_customer_id) {
      try {
        await stripe.customers.retrieve(userData.stripe_customer_id)
        console.log(`Customer ${userData.stripe_customer_id} already exists in Stripe`)
        return NextResponse.json({ 
          customerId: userData.stripe_customer_id,
          message: 'Stripe顧客は既に存在します'
        })
      } catch (error: any) {
        // 顧客が存在しない場合は新規作成
        console.error(`Customer ${userData.stripe_customer_id} not found in Stripe:`, error.message)
      }
    }

    // Stripe顧客を作成
    console.log(`Creating new Stripe customer for user ${user.id}`)
    
    // 顧客名を決定（個人の場合はname、法人の場合はcompany_name）
    const { formatJapaneseName } = await import('@/lib/utils/name')
    const customerName = userData.is_individual === false && userData.company_name
      ? userData.company_name
      : formatJapaneseName(userData.name) || user.email || undefined

    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: customerName,
      metadata: {
        user_id: user.id,
        is_individual: userData.is_individual ? 'true' : 'false',
      },
    })

    console.log(`Created new Stripe customer: ${customer.id} (name: ${customerName})`)

    // データベースに保存
    const { error: updateError } = await supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update stripe_customer_id:', updateError)
      // Stripe顧客は作成されたが、データベース更新に失敗した場合でも成功として返す
    }

    return NextResponse.json({
      customerId: customer.id,
      message: 'Stripe顧客を作成しました'
    })
  } catch (error: any) {
    console.error('Stripe customer creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Stripe顧客の作成に失敗しました' },
      { status: 500 }
    )
  }
}

