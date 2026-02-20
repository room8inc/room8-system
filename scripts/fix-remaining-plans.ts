/**
 * プラン未紐付けの旧会員にプランを割り当てる
 *
 * npx tsx scripts/fix-remaining-plans.ts --dry-run
 * npx tsx scripts/fix-remaining-plans.ts
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

// 旧プラン名 → 現行プランコード + タイプのマッピング
// 会議室予約の扱いは全員同じなので、最も近いプランに割り当てる
const LEGACY_PLAN_MAP: Record<string, { planCode: string; planType: string; note: string }> = {
  // シェアオフィス旧 → レギュラープラン(shared_office)
  'シェアオフィス旧': { planCode: 'regular', planType: 'shared_office', note: '旧シェアオフィスプランから移行' },
  // シェアオフィス年払い → レギュラープラン(shared_office)
  'シェアオフィス 年払い': { planCode: 'regular', planType: 'shared_office', note: '旧シェアオフィス年払いから移行' },
  // バーチャルオフィス → レギュラープラン(workspace) ※実際の利用時間帯は異なるが会議室アクセスは同等
  'バーチャルオフィス': { planCode: 'regular', planType: 'workspace', note: 'バーチャルオフィス会員（会議室利用可）' },
  // オプション → フルタイム(workspace) ※オプションのみの人は何らかのベースプランがあるはず
  'オプション': { planCode: 'fulltime', planType: 'workspace', note: 'オプションのみ契約（ベースプラン不明のためフルタイム割当）' },
  // コワーキングスペース会費 → フルタイム(workspace) ※旧名称
  'コワーキングスペース会費': { planCode: 'fulltime', planType: 'workspace', note: '旧コワーキング会費から移行' },
  // 休会 → フルタイム(workspace) ※休会中だがmember_typeはregularのまま
  '休会': { planCode: 'fulltime', planType: 'workspace', note: '休会中（Stripe上は¥550で維持）' },
}

// 除外するStripe商品名
const EXCLUDED_PRODUCTS = ['Webサイト保守']

async function main() {
  // Supabaseのプラン一覧
  const { data: plans } = await supabase.from('plans').select('id, code, name')
  const planMap = new Map(plans?.map((p) => [p.code, p]) || [])

  // プラン未紐付けの会員を取得
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, name, member_type, stripe_customer_id')
    .eq('member_type', 'regular')

  if (!allUsers) {
    console.log('会員が見つかりません')
    return
  }

  // 既にプラン紐付け済みのユーザーIDを取得
  const { data: existingPlans } = await supabase
    .from('user_plans')
    .select('user_id')
    .eq('status', 'active')

  const usersWithPlan = new Set(existingPlans?.map((p) => p.user_id) || [])

  // プラン未紐付けの会員
  const unlinked = allUsers.filter((u) => !usersWithPlan.has(u.id))
  console.log(`プラン未紐付けの会員: ${unlinked.length}件\n`)

  if (unlinked.length === 0) {
    console.log('全員プラン紐付け済み')
    return
  }

  // Stripeから商品名を取得
  console.log('Stripeから商品情報を取得中...')
  let linked = 0
  let skipped = 0

  for (const user of unlinked) {
    if (!user.stripe_customer_id) {
      console.log(`${user.name} <${user.email}> → スキップ（Stripe未連携）`)
      skipped++
      continue
    }

    // Stripeからサブスクリプション情報を取得
    let subs
    try {
      subs = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active',
        limit: 1,
      })
    } catch (err: any) {
      console.log(`${user.name} <${user.email}> → スキップ（Stripeエラー: ${err.message}）`)
      skipped++
      continue
    }

    if (subs.data.length === 0) {
      console.log(`${user.name} <${user.email}> → スキップ（アクティブなサブスクなし）`)
      skipped++
      continue
    }

    const sub = subs.data[0]
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

    // 除外チェック
    if (EXCLUDED_PRODUCTS.some((ex) => productName.includes(ex))) {
      console.log(`${user.name} <${user.email}> | ${productName} → 除外（非コワーキング）`)
      // member_typeをguestに戻す
      if (!DRY_RUN) {
        await supabase.from('users').update({ member_type: 'guest' }).eq('id', user.id)
        console.log(`  → member_type を guest に変更`)
      } else {
        console.log(`  → [DRY RUN] member_type を guest に変更予定`)
      }
      skipped++
      continue
    }

    // マッピング
    const mapping = LEGACY_PLAN_MAP[productName]
    if (!mapping) {
      console.log(`${user.name} <${user.email}> | ${productName} → マッピング未定義（スキップ）`)
      skipped++
      continue
    }

    const plan = planMap.get(mapping.planCode)
    if (!plan) {
      console.log(`${user.name} <${user.email}> | ${productName} → プラン "${mapping.planCode}" がDBに存在しない`)
      skipped++
      continue
    }

    console.log(
      `${user.name} <${user.email}> | ${productName} → ${plan.name} (${mapping.planType}) [${mapping.note}]`
    )

    if (!DRY_RUN) {
      const { error } = await supabase.from('user_plans').insert({
        user_id: user.id,
        plan_id: plan.id,
        started_at: new Date().toISOString().split('T')[0],
        status: 'active',
        plan_type: mapping.planType,
      })

      if (error) {
        console.error(`  → エラー: ${error.message}`)
      } else {
        console.log(`  → プラン紐付けOK`)
        linked++
      }
    } else {
      console.log(`  → [DRY RUN]`)
      linked++
    }
  }

  console.log(`\n=== 結果 ===`)
  console.log(`プラン紐付け: ${linked}`)
  console.log(`スキップ: ${skipped}`)
}

main()
