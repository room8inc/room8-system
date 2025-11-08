import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const userId = process.argv[2]

if (!userId) {
  console.error('Usage: npx tsx scripts/check-user-plan.ts <userId>')
  process.exit(1)
}

async function main() {
  console.log(`ユーザーID: ${userId} のプラン情報を取得`)

  const { data, error } = await supabase
    .from('user_plans')
    .select('id, status, started_at, ended_at, cancellation_scheduled_date, cancellation_fee, cancellation_fee_paid, plan_change_scheduled_date, new_plan_id, stripe_subscription_id, plan_id, plans:plan_id(name, price)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(JSON.stringify(data, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unhandled error:', err)
    process.exit(1)
  })
