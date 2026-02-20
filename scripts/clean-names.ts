/**
 * ユーザー名から「様」「御中」を除去する
 * npx tsx scripts/clean-names.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  const { data: users } = await supabase.from('users').select('id, name').order('name')
  if (!users) return

  let count = 0
  for (const u of users) {
    if (!u.name) continue
    const cleaned = u.name
      .replace(/\s*(様|御中)\s*$/g, '')
      .replace(/^\s*(様|御中)\s*/g, '')
      .trim()

    if (cleaned !== u.name) {
      console.log(`  "${u.name}"  =>  "${cleaned}"`)
      await supabase.from('users').update({ name: cleaned }).eq('id', u.id)
      count++
    }
  }
  console.log(`\n修正: ${count}件`)
}

main()
