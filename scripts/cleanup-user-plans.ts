/**
 * 今回のインポートで作成された user_plans を全削除する
 * usersテーブル（member_type, stripe_customer_id）はそのまま残す
 *
 * npx tsx scripts/cleanup-user-plans.ts --dry-run
 * npx tsx scripts/cleanup-user-plans.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  // 今日作成された user_plans を取得（今回のインポート分）
  const today = new Date().toISOString().split('T')[0]

  const { data: plans, error } = await supabase
    .from('user_plans')
    .select('id, user_id, plan_id, started_at, status, plan_type, plans:plans!user_plans_plan_id_fkey(name)')
    .eq('started_at', today)
    .eq('status', 'active')

  if (error) {
    console.error('取得エラー:', error.message)
    return
  }

  console.log(`今日(${today})作成されたuser_plans: ${plans?.length || 0}件\n`)

  if (!plans || plans.length === 0) {
    console.log('削除対象なし')
    return
  }

  for (const p of plans) {
    const planName = (p.plans as any)?.name || 'Unknown'
    console.log(`  id=${p.id} | plan=${planName} (${p.plan_type}) | started=${p.started_at}`)
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] ${plans.length}件を削除予定`)
    return
  }

  const ids = plans.map(p => p.id)
  const { error: delError } = await supabase
    .from('user_plans')
    .delete()
    .in('id', ids)

  if (delError) {
    console.error('削除エラー:', delError.message)
  } else {
    console.log(`\n${plans.length}件のuser_plansを削除しました`)
  }
}

main()
