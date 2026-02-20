/**
 * Stripe インポート修正スクリプト
 *
 * 前回の import-stripe-members.ts で Auth ユーザーは作成済みだが
 * public.users の更新と user_plans の作成が失敗した分を修正する。
 *
 * npx tsx scripts/fix-imported-members.ts --dry-run
 * npx tsx scripts/fix-imported-members.ts
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover' as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

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

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY が設定されていません')
    process.exit(1)
  }

  // Supabaseのプラン一覧
  const { data: plans } = await supabase.from('plans').select('id, code, name')
  const planMap = new Map(plans?.map((p) => [p.code, p]) || [])

  // Supabaseの全ユーザー（emailでマッチさせる）
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, member_type, stripe_customer_id')

  const userByEmail = new Map(allUsers?.map((u) => [u.email, u]) || [])

  // Stripeのアクティブ顧客を取得
  console.log('Stripeから顧客情報を取得中...')
  let customers: any[] = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const params: any = { limit: 100, expand: ['data.subscriptions'] }
    if (startingAfter) params.starting_after = startingAfter

    const response = await stripe.customers.list(params)

    for (const customer of response.data) {
      const subs = customer.subscriptions?.data || []
      const activeSubs = subs.filter(
        (s: any) => s.status === 'active' || s.status === 'trialing'
      )
      if (activeSubs.length === 0) continue

      const sub = activeSubs[0]
      const item = sub.items.data[0]
      let productName = 'Unknown'

      if (item?.price?.product) {
        const productId = typeof item.price.product === 'string'
          ? item.price.product
          : item.price.product.id
        try {
          const product = await stripe.products.retrieve(productId)
          productName = product.name
        } catch {
          productName = productId
        }
      }

      customers.push({
        stripeCustomerId: customer.id,
        email: customer.email || '',
        name: customer.name || customer.email || '',
        phone: customer.phone || null,
        productName,
        planCode: guessPlanCode(productName),
        amount: item?.price?.unit_amount || 0,
        interval: item?.price?.recurring?.interval || 'month',
        subscriptionId: sub.id,
      })
    }

    hasMore = response.has_more
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id
    }
  }

  console.log(`\nアクティブ顧客: ${customers.length}件`)
  console.log(`=== ${DRY_RUN ? 'ドライラン' : '実行'} ===\n`)

  let updated = 0
  let planLinked = 0
  let skipped = 0
  let errors = 0

  for (const c of customers) {
    const dbUser = userByEmail.get(c.email)

    console.log(
      `${c.name} <${c.email}> | ${c.productName} → ${c.planCode || '不明'} | ¥${c.amount.toLocaleString()}/${c.interval}`
    )

    if (!dbUser) {
      console.log(`  → スキップ（Supabaseにユーザーが存在しない）`)
      skipped++
      continue
    }

    // 1. public.users を更新（stripe_customer_id, member_type, name）
    if (!dbUser.stripe_customer_id || dbUser.member_type !== 'regular') {
      if (DRY_RUN) {
        console.log(`  → [DRY RUN] UPDATE users: member_type=regular, stripe_customer_id=${c.stripeCustomerId}`)
      } else {
        const { error } = await supabase
          .from('users')
          .update({
            stripe_customer_id: c.stripeCustomerId,
            member_type: 'regular',
            name: c.name,
            phone: c.phone,
          })
          .eq('id', dbUser.id)

        if (error) {
          console.error(`  → UPDATE失敗: ${error.message}`)
          errors++
          continue
        }
        console.log(`  → users更新OK`)
      }
      updated++
    } else {
      console.log(`  → users既に更新済み`)
    }

    // 2. user_plans を作成
    const plan = c.planCode ? planMap.get(c.planCode) : null
    if (plan) {
      // 既存のuser_plansをチェック
      const { data: existingPlans } = await supabase
        .from('user_plans')
        .select('id')
        .eq('user_id', dbUser.id)
        .eq('status', 'active')

      if (existingPlans && existingPlans.length > 0) {
        console.log(`  → プラン既に紐付け済み`)
      } else {
        if (DRY_RUN) {
          console.log(`  → [DRY RUN] INSERT user_plans: plan=${plan.name}`)
        } else {
          const planType = ['entrepreneur', 'regular', 'light'].includes(c.planCode!)
            ? 'shared_office'
            : 'workspace'

          const { error } = await supabase.from('user_plans').insert({
            user_id: dbUser.id,
            plan_id: plan.id,
            started_at: new Date().toISOString().split('T')[0],
            status: 'active',
            plan_type: planType,
          })

          if (error) {
            console.error(`  → user_plans作成エラー: ${error.message}`)
            errors++
          } else {
            console.log(`  → プラン紐付けOK: ${plan.name}`)
            planLinked++
          }
        }
      }
    } else {
      console.log(`  → プラン紐付けなし（マッピング不明: ${c.productName}）`)
    }
  }

  console.log(`\n=== 結果 ===`)
  console.log(`users更新: ${updated}`)
  console.log(`プラン紐付け: ${planLinked}`)
  console.log(`スキップ: ${skipped}`)
  console.log(`エラー: ${errors}`)
}

main()
