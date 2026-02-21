/**
 * 銀行振込会員を手動追加する
 * npx tsx scripts/add-bank-transfer-members.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const NEW_MEMBERS = [
  { name: '株式会社新朝プレス', email: 'soumu@monmiya.co.jp', isIndividual: false },
  { name: '井本健太', email: 'k2000imoto@gmail.com', isIndividual: true },
]

async function main() {
  for (const m of NEW_MEMBERS) {
    // 1. Auth ユーザー作成
    const tempPassword = `Room8_${Math.random().toString(36).slice(2, 10)}`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: m.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: m.name, imported_from: 'bank_transfer' },
    })

    if (authError) {
      console.log(`${m.name} <${m.email}> → Auth作成エラー: ${authError.message}`)
      continue
    }

    const userId = authData.user.id

    // 2. users テーブル更新（トリガーで作成済みのレコードを更新）
    const { error: updateError } = await supabase
      .from('users')
      .update({
        name: m.name,
        member_type: 'regular',
        is_individual: m.isIndividual,
        status: 'active',
        membership_note: '銀行振込',
      })
      .eq('id', userId)

    if (updateError) {
      console.log(`${m.name} → users更新エラー: ${updateError.message}`)
    } else {
      console.log(`${m.name} <${m.email}> → 登録OK (userId: ${userId})`)
    }
  }
}

main()
