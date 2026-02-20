/**
 * Stripe会員 → Supabase インポートスクリプト
 *
 * 使い方:
 *   npx tsx scripts/import-stripe-members.ts --dry-run   # 確認のみ
 *   npx tsx scripts/import-stripe-members.ts              # 実行
 *
 * 環境変数(.env.local から読み込み):
 *   STRIPE_SECRET_KEY         - 本番Stripe APIキー
 *   NEXT_PUBLIC_SUPABASE_URL  - Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// .env.local を読み込む
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover' as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// プランコードをStripe Product/Price名からマッピング
const PLAN_NAME_MAP: Record<string, string> = {
  '起業家': 'entrepreneur',
  'entrepreneur': 'entrepreneur',
  'レギュラー': 'regular',
  'regular': 'regular',
  'ライト': 'light',
  'light': 'light',
  'フルタイム': 'fulltime',
  'fulltime': 'fulltime',
  'ウィークデイ': 'weekday',
  'weekday': 'weekday',
  'デイタイム': 'daytime',
  'daytime': 'daytime',
  'ナイト&ホリデー': 'night_holiday',
  'night_holiday': 'night_holiday',
  'ナイト': 'night',
  'night': 'night',
  'ホリデー': 'holiday',
  'holiday': 'holiday',
}

function guessPlanCode(productName: string): string | null {
  const lower = productName.toLowerCase()
  for (const [keyword, code] of Object.entries(PLAN_NAME_MAP)) {
    if (lower.includes(keyword.toLowerCase())) {
      return code
    }
  }
  return null
}

interface StripeCustomerInfo {
  stripeCustomerId: string
  email: string
  name: string
  phone: string | null
  subscriptions: {
    id: string
    status: string
    productName: string
    planCode: string | null
    amount: number
    interval: string
    currentPeriodEnd: Date
  }[]
}

async function fetchStripeCustomers(): Promise<StripeCustomerInfo[]> {
  const customers: StripeCustomerInfo[] = []
  let hasMore = true
  let startingAfter: string | undefined

  console.log('Stripeから顧客情報を取得中...')

  while (hasMore) {
    const params: Stripe.CustomerListParams = {
      limit: 100,
      expand: ['data.subscriptions'],
    }
    if (startingAfter) {
      params.starting_after = startingAfter
    }

    const response = await stripe.customers.list(params)

    for (const customer of response.data) {
      const subs = customer.subscriptions?.data || []

      // アクティブなサブスクリプションを持つ顧客のみ
      const activeSubs = subs.filter(
        (s) => s.status === 'active' || s.status === 'trialing'
      )

      if (activeSubs.length === 0) continue

      const subscriptions = await Promise.all(
        activeSubs.map(async (sub) => {
          const item = sub.items.data[0]
          let productName = 'Unknown'

          if (item?.price?.product) {
            const productId =
              typeof item.price.product === 'string'
                ? item.price.product
                : item.price.product.id
            try {
              const product = await stripe.products.retrieve(productId)
              productName = product.name
            } catch {
              productName = productId
            }
          }

          return {
            id: sub.id,
            status: sub.status,
            productName,
            planCode: guessPlanCode(productName),
            amount: item?.price?.unit_amount || 0,
            interval: item?.price?.recurring?.interval || 'month',
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          }
        })
      )

      customers.push({
        stripeCustomerId: customer.id,
        email: customer.email || '',
        name: customer.name || customer.email || '',
        phone: customer.phone || null,
        subscriptions,
      })
    }

    hasMore = response.has_more
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id
    }
  }

  return customers
}

async function importToSupabase(customers: StripeCustomerInfo[]) {
  console.log(`\n=== ${DRY_RUN ? 'ドライラン' : '実行'} ===`)
  console.log(`対象顧客数: ${customers.length}\n`)

  // Supabaseの既存プランを取得
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('id, code, name')

  if (plansError) {
    console.error('プラン取得エラー:', plansError)
    return
  }

  const planMap = new Map(plans?.map((p) => [p.code, p]) || [])

  // 既存ユーザーを取得（重複チェック用）
  const { data: existingUsers } = await supabase
    .from('users')
    .select('email, stripe_customer_id')

  const existingEmails = new Set(existingUsers?.map((u) => u.email) || [])
  const existingStripeIds = new Set(
    existingUsers?.filter((u) => u.stripe_customer_id).map((u) => u.stripe_customer_id) || []
  )

  let created = 0
  let skipped = 0
  let errors = 0

  for (const customer of customers) {
    const sub = customer.subscriptions[0] // プライマリのサブスクリプション
    const planCode = sub.planCode
    const plan = planCode ? planMap.get(planCode) : null

    // ログ出力
    console.log(
      `${customer.name} <${customer.email}> | Stripe: ${customer.stripeCustomerId} | ` +
      `プラン: ${sub.productName} → ${planCode || '不明'} | ` +
      `¥${sub.amount.toLocaleString()}/${sub.interval}`
    )

    // 重複チェック
    if (existingEmails.has(customer.email)) {
      console.log(`  → スキップ（メールアドレスが既に存在）`)
      skipped++
      continue
    }
    if (existingStripeIds.has(customer.stripeCustomerId)) {
      console.log(`  → スキップ（Stripe Customer IDが既に存在）`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`  → [DRY RUN] 登録予定`)
      created++
      continue
    }

    // Supabase Auth にユーザー作成
    const tempPassword = `Room8_${Math.random().toString(36).slice(2, 10)}`
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: customer.email,
        password: tempPassword,
        email_confirm: true, // メール確認をスキップ
        user_metadata: {
          name: customer.name,
          imported_from: 'stripe',
        },
      })

    if (authError) {
      console.error(`  → Auth作成エラー: ${authError.message}`)
      errors++
      continue
    }

    const userId = authData.user.id

    // usersテーブルにレコード作成
    const { error: userError } = await supabase.from('users').upsert(
      {
        id: userId,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        member_type: 'regular',
        is_individual: true,
        status: 'active',
        stripe_customer_id: customer.stripeCustomerId,
        membership_note: `Stripeインポート ${new Date().toISOString().split('T')[0]}`,
      },
      { onConflict: 'id' }
    )

    if (userError) {
      console.error(`  → users作成エラー: ${userError.message}`)
      errors++
      continue
    }

    // user_plansにプラン紐付け
    if (plan) {
      const { error: planError } = await supabase.from('user_plans').insert({
        user_id: userId,
        plan_id: plan.id,
        started_at: new Date().toISOString().split('T')[0],
        status: 'active',
        plan_type: planCode && ['entrepreneur', 'regular', 'light'].includes(planCode)
          ? 'shared_office'
          : 'workspace',
      })

      if (planError) {
        console.error(`  → user_plans作成エラー: ${planError.message}`)
        errors++
        continue
      }
    } else {
      console.log(`  → プラン紐付けなし（マッピング不明: ${sub.productName}）`)
    }

    console.log(`  → 登録完了 (userId: ${userId})`)
    created++
  }

  console.log(`\n=== 結果 ===`)
  console.log(`登録: ${created}`)
  console.log(`スキップ: ${skipped}`)
  console.log(`エラー: ${errors}`)
}

async function main() {
  try {
    // 環境変数チェック
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY が設定されていません')
      process.exit(1)
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase環境変数が設定されていません')
      process.exit(1)
    }

    const customers = await fetchStripeCustomers()
    console.log(`\nアクティブな顧客: ${customers.length}件`)

    if (customers.length === 0) {
      console.log('インポート対象の顧客がいません')
      return
    }

    await importToSupabase(customers)
  } catch (error: any) {
    console.error('エラー:', error.message)
    process.exit(1)
  }
}

main()
