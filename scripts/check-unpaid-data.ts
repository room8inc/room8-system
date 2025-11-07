/**
 * 未決済のドロップイン利用データを確認するスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/check-unpaid-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// .env.localファイルを読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUnpaidData() {
  console.log('未決済のドロップイン利用データを確認中...\n')

  // 未決済のドロップイン利用を取得
  const { data: unpaidCheckouts, error: fetchError } = await supabase
    .from('checkins')
    .select('id, user_id, checkin_at, checkout_at, duration_minutes, dropin_fee, payment_status, stripe_payment_intent_id, member_type_at_checkin')
    .eq('member_type_at_checkin', 'dropin')
    .not('checkout_at', 'is', null)
    .eq('payment_status', 'pending')
    .order('checkout_at', { ascending: false })

  if (fetchError) {
    console.error('データ取得エラー:', fetchError)
    return
  }

  if (!unpaidCheckouts || unpaidCheckouts.length === 0) {
    console.log('未決済のドロップイン利用はありません')
    return
  }

  console.log(`\n${unpaidCheckouts.length}件の未決済利用が見つかりました:\n`)

  unpaidCheckouts.forEach((checkout, index) => {
    console.log(`--- ${index + 1}件目 ---`)
    console.log(`ID: ${checkout.id}`)
    console.log(`チェックイン: ${new Date(checkout.checkin_at).toLocaleString('ja-JP')}`)
    console.log(`チェックアウト: ${new Date(checkout.checkout_at).toLocaleString('ja-JP')}`)
    console.log(`滞在時間: ${checkout.duration_minutes || 'null'}分`)
    console.log(`料金: ${checkout.dropin_fee !== null ? checkout.dropin_fee + '円' : 'null'}`)
    console.log(`決済状態: ${checkout.payment_status}`)
    console.log(`Payment Intent ID: ${checkout.stripe_payment_intent_id || 'null'}`)
    console.log('')
  })

  // 問題のあるデータを分析
  const problems: string[] = []
  
  unpaidCheckouts.forEach((checkout) => {
    if (checkout.dropin_fee === null) {
      problems.push(`ID ${checkout.id}: dropin_feeがnull`)
    }
    if (checkout.duration_minutes === null) {
      problems.push(`ID ${checkout.id}: duration_minutesがnull`)
    }
    if (checkout.stripe_payment_intent_id && checkout.dropin_fee === null) {
      problems.push(`ID ${checkout.id}: 古い決済方式のデータ（Payment Intent IDがあるがdropin_feeがnull）`)
    }
  })

  if (problems.length > 0) {
    console.log('\n⚠️ 問題のあるデータ:')
    problems.forEach(problem => console.log(`  - ${problem}`))
  } else {
    console.log('\n✅ データに問題は見つかりませんでした')
  }
}

checkUnpaidData()
  .then(() => {
    console.log('\n確認が完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('エラーが発生しました:', error)
    process.exit(1)
  })

