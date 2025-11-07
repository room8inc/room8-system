/**
 * 未決済のドロップイン利用の料金を再計算するスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/fix-unpaid-dropin-fees.ts
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

// 料金計算ロジック（APIと同じ）
const calculateDropinFee = (durationMinutes: number): number => {
  const HOURLY_RATE = 400 // 1時間あたりの料金（円）
  const MAX_FEE = 2000 // 最大料金（円）

  const durationHours = Math.ceil(durationMinutes / 60) // 切り上げ
  const actualFee = Math.min(durationHours * HOURLY_RATE, MAX_FEE)

  return actualFee
}

async function fixUnpaidDropinFees() {
  console.log('未決済のドロップイン利用を検索中...')

  // 未決済のドロップイン利用を取得
  const { data: unpaidCheckouts, error: fetchError } = await supabase
    .from('checkins')
    .select('id, duration_minutes, dropin_fee, payment_status, checkout_at')
    .eq('member_type_at_checkin', 'dropin')
    .not('checkout_at', 'is', null)
    .eq('payment_status', 'pending')

  if (fetchError) {
    console.error('データ取得エラー:', fetchError)
    return
  }

  if (!unpaidCheckouts || unpaidCheckouts.length === 0) {
    console.log('未決済のドロップイン利用はありません')
    return
  }

  console.log(`${unpaidCheckouts.length}件の未決済利用が見つかりました`)

  let fixedCount = 0
  let errorCount = 0

  for (const checkout of unpaidCheckouts) {
    if (!checkout.duration_minutes) {
      console.warn(`チェックインID ${checkout.id}: duration_minutesがnullです。スキップします。`)
      continue
    }

    // 料金を再計算
    const calculatedFee = calculateDropinFee(checkout.duration_minutes)

    // 既に正しい料金が設定されている場合はスキップ
    if (checkout.dropin_fee === calculatedFee) {
      console.log(`チェックインID ${checkout.id}: 料金は既に正しいです (${calculatedFee}円)`)
      continue
    }

    // 料金を更新
    const { error: updateError } = await supabase
      .from('checkins')
      .update({
        dropin_fee: calculatedFee,
      })
      .eq('id', checkout.id)

    if (updateError) {
      console.error(`チェックインID ${checkout.id}: 更新エラー`, updateError)
      errorCount++
    } else {
      console.log(`チェックインID ${checkout.id}: 料金を更新しました (${checkout.dropin_fee || 'null'} → ${calculatedFee}円)`)
      fixedCount++
    }
  }

  console.log(`\n完了:`)
  console.log(`- 修正: ${fixedCount}件`)
  console.log(`- エラー: ${errorCount}件`)
  console.log(`- スキップ: ${unpaidCheckouts.length - fixedCount - errorCount}件`)
}

fixUnpaidDropinFees()
  .then(() => {
    console.log('処理が完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('エラーが発生しました:', error)
    process.exit(1)
  })

