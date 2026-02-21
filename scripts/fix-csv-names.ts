import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Fix PayPay English names to Japanese order (FIRST LAST → LAST FIRST)
  const nameFixes: Record<string, string> = {
    'hashimoto@bagooon.com': 'HASHIMOTO TAKASHI',
    'imanoyujin@gmail.com': 'IMANO YUJI',
    'nakashima5555@gmail.com': 'NAKASHIMA TOSHIHARU',
  }

  // Fix 山﨑脩登 encoding issue
  const encodingFixes: Record<string, string> = {
    'goshoot7@gmail.com': '山﨑脩登',
  }

  const allFixes = { ...nameFixes, ...encodingFixes }

  for (const [email, correctName] of Object.entries(allFixes)) {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email)
      .single()

    if (!user) {
      console.log(`  ✗ ${email} not found`)
      continue
    }

    console.log(`  ${user.name} → ${correctName}`)
    const { error } = await supabase
      .from('users')
      .update({ name: correctName })
      .eq('id', user.id)

    if (error) {
      console.log(`    ERROR: ${error.message}`)
    } else {
      console.log(`    OK`)
    }
  }
}

main()
