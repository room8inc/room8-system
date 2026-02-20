/**
 * 会員のシェアオフィスオプションフラグを設定する
 *
 * - Stripe商品名から判定
 * - 明確な人は自動でON
 * - イレギュラーな人はリストアップして鶴田さんに確認
 *
 * npx tsx scripts/set-shared-office-flags.ts --dry-run
 * npx tsx scripts/set-shared-office-flags.ts
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

// シェアオフィス確定の商品名パターン
const SHARED_OFFICE_PRODUCTS = [
  'シェアオフィス',   // 「シェアオフィス旧」「シェアオフィス 年払い」等
  '起業家',           // 起業家プランはバンドルでシェアオフィス込み
  'レギュラー',       // 現行レギュラー(shared_office)で契約してる人
  'ライト',           // 現行ライト(shared_office)で契約してる人
]

// ワークスペースのみ確定
const WORKSPACE_ONLY_PRODUCTS = [
  'フルタイム',
  'ウィークデイ',
  'デイタイム',
  'ナイト',
  'ホリデー',
  'コワーキングスペース会費',
]

// 要確認（鶴田さんに聞く）
// バーチャルオフィス、休会、オプション 等

async function main() {
  // 会員一覧
  const { data: members } = await supabase
    .from('users')
    .select('id, name, email, stripe_customer_id, has_shared_office')
    .eq('member_type', 'regular')
    .order('name')

  if (!members || members.length === 0) {
    console.log('会員がいません')
    return
  }

  console.log(`会員数: ${members.length}`)
  console.log(`=== ${DRY_RUN ? 'ドライラン' : '実行'} ===\n`)

  const autoOn: string[] = []
  const autoOff: string[] = []
  const needConfirm: { name: string; email: string; product: string }[] = []
  let updated = 0

  for (const m of members) {
    if (!m.stripe_customer_id) {
      console.log(`${m.name} <${m.email}> → Stripe未連携（スキップ）`)
      continue
    }

    // Stripe商品名を取得
    let productName = 'Unknown'
    try {
      const subs = await stripe.subscriptions.list({
        customer: m.stripe_customer_id,
        status: 'active',
        limit: 1,
      })

      if (subs.data.length === 0) {
        console.log(`${m.name} <${m.email}> → サブスクなし（スキップ）`)
        continue
      }

      const item = subs.data[0].items.data[0]
      if (item?.price?.product) {
        const productId = typeof item.price.product === 'string'
          ? item.price.product
          : item.price.product.id
        const product = await stripe.products.retrieve(productId)
        productName = product.name
      }
    } catch (err: any) {
      console.log(`${m.name} <${m.email}> → Stripeエラー: ${err.message}（スキップ）`)
      continue
    }

    // 判定
    const isSharedOffice = SHARED_OFFICE_PRODUCTS.some(p => productName.includes(p))
    const isWorkspaceOnly = WORKSPACE_ONLY_PRODUCTS.some(p => productName.includes(p))

    if (isSharedOffice) {
      console.log(`${m.name} | ${productName} → シェアオフィスON`)
      autoOn.push(`${m.name} (${productName})`)
      if (!DRY_RUN) {
        await supabase.from('users').update({ has_shared_office: true }).eq('id', m.id)
        updated++
      }
    } else if (isWorkspaceOnly) {
      console.log(`${m.name} | ${productName} → ワークスペースのみ（変更なし）`)
      autoOff.push(`${m.name} (${productName})`)
    } else {
      console.log(`${m.name} | ${productName} → ★要確認★`)
      needConfirm.push({ name: m.name, email: m.email, product: productName })
    }
  }

  console.log(`\n=== 結果 ===`)
  console.log(`シェアオフィスON: ${autoOn.length}件`)
  console.log(`ワークスペースのみ: ${autoOff.length}件`)
  console.log(`要確認: ${needConfirm.length}件`)
  if (!DRY_RUN) console.log(`DB更新: ${updated}件`)

  if (needConfirm.length > 0) {
    console.log(`\n=== 鶴田さんに確認が必要 ===`)
    for (const c of needConfirm) {
      console.log(`  ${c.name} <${c.email}> | Stripe商品: ${c.product}`)
    }
  }
}

main()
