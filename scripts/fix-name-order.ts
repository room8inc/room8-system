/**
 * ローマ字名の姓名順を修正（Western → Japanese order）
 * npx tsx scripts/fix-name-order.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// 名 姓 → 姓 名 に修正するリスト
const FIXES: Record<string, string> = {
  'KANICHI KUNIMOTO': 'KUNIMOTO KANICHI',
  'NAOKO HARA': 'HARA NAOKO',
}

async function main() {
  for (const [from, to] of Object.entries(FIXES)) {
    const { data, error } = await supabase
      .from('users')
      .update({ name: to })
      .eq('name', from)
      .select('id, name')

    if (error) {
      console.log(`${from} → エラー: ${error.message}`)
    } else if (data && data.length > 0) {
      console.log(`"${from}"  =>  "${to}"`)
    } else {
      console.log(`"${from}" → 該当なし（スキップ）`)
    }
  }
  console.log('\n完了')
}

main()
