/**
 * 古い決済方式のデータをクリーンアップするスクリプト
 * 
 * 古い決済方式（チェックイン時に事前決済）のデータを削除または更新
 * 
 * 使用方法:
 * npx tsx scripts/cleanup-old-payment-data.ts
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

async function cleanupOldPaymentData() {
  console.log('古い決済方式のデータを検索中...\n')

  // 古い決済方式のデータを取得
  // 条件: stripe_payment_intent_idがあるがdropin_feeがnull、または両方null
  const { data: oldData, error: fetchError } = await supabase
    .from('checkins')
    .select('id, user_id, checkin_at, checkout_at, duration_minutes, dropin_fee, payment_status, stripe_payment_intent_id, member_type_at_checkin')
    .eq('member_type_at_checkin', 'dropin')
    .not('checkout_at', 'is', null)
    .eq('payment_status', 'pending')

  if (fetchError) {
    console.error('データ取得エラー:', fetchError)
    return
  }

  if (!oldData || oldData.length === 0) {
    console.log('古い決済方式のデータは見つかりませんでした')
    return
  }

  console.log(`${oldData.length}件の未決済データが見つかりました\n`)

  // 古い決済方式のデータを特定
  const oldPaymentData = oldData.filter(checkout => {
    // 古い決済方式: stripe_payment_intent_idがあるがdropin_feeがnull
    if (checkout.stripe_payment_intent_id && checkout.dropin_fee === null) {
      return true
    }
    // データ不整合: dropin_feeとduration_minutesが両方null
    if (checkout.dropin_fee === null && checkout.duration_minutes === null) {
      return true
    }
    return false
  })

  if (oldPaymentData.length === 0) {
    console.log('古い決済方式のデータは見つかりませんでした')
    return
  }

  console.log(`${oldPaymentData.length}件の古い決済方式のデータが見つかりました:\n`)

  oldPaymentData.forEach((checkout, index) => {
    console.log(`--- ${index + 1}件目 ---`)
    console.log(`ID: ${checkout.id}`)
    console.log(`チェックイン: ${new Date(checkout.checkin_at).toLocaleString('ja-JP')}`)
    console.log(`チェックアウト: ${new Date(checkout.checkout_at).toLocaleString('ja-JP')}`)
    console.log(`滞在時間: ${checkout.duration_minutes || 'null'}分`)
    console.log(`料金: ${checkout.dropin_fee !== null ? checkout.dropin_fee + '円' : 'null'}`)
    console.log(`Payment Intent ID: ${checkout.stripe_payment_intent_id || 'null'}`)
    console.log('')
  })

  console.log('\nこれらのデータを削除または更新しますか？')
  console.log('1. 削除（推奨）')
  console.log('2. 料金を計算して更新（duration_minutesがある場合のみ）')
  console.log('3. キャンセル')

  // 簡易版: 自動的に削除（本番環境では確認プロンプトを追加することを推奨）
  const action = '1' // デフォルトは削除

  if (action === '1') {
    // 削除
    console.log('\nデータを削除中...')
    let deletedCount = 0
    let errorCount = 0

    for (const checkout of oldPaymentData) {
      const { error: deleteError } = await supabase
        .from('checkins')
        .delete()
        .eq('id', checkout.id)

      if (deleteError) {
        console.error(`ID ${checkout.id}: 削除エラー`, deleteError)
        errorCount++
      } else {
        console.log(`ID ${checkout.id}: 削除しました`)
        deletedCount++
      }
    }

    console.log(`\n完了:`)
    console.log(`- 削除: ${deletedCount}件`)
    console.log(`- エラー: ${errorCount}件`)
  } else if (action === '2') {
    // 料金を計算して更新
    console.log('\n料金を計算して更新中...')
    let updatedCount = 0
    let errorCount = 0
    let skippedCount = 0

    for (const checkout of oldPaymentData) {
      if (!checkout.duration_minutes) {
        console.warn(`ID ${checkout.id}: duration_minutesがnullのためスキップ`)
        skippedCount++
        continue
      }

      const calculatedFee = calculateDropinFee(checkout.duration_minutes)

      const { error: updateError } = await supabase
        .from('checkins')
        .update({
          dropin_fee: calculatedFee,
          stripe_payment_intent_id: null, // 古いPayment Intent IDをクリア
        })
        .eq('id', checkout.id)

      if (updateError) {
        console.error(`ID ${checkout.id}: 更新エラー`, updateError)
        errorCount++
      } else {
        console.log(`ID ${checkout.id}: 料金を更新しました (${calculatedFee}円)`)
        updatedCount++
      }
    }

    console.log(`\n完了:`)
    console.log(`- 更新: ${updatedCount}件`)
    console.log(`- スキップ: ${skippedCount}件`)
    console.log(`- エラー: ${errorCount}件`)
  } else {
    console.log('キャンセルしました')
  }
}

cleanupOldPaymentData()
  .then(() => {
    console.log('\n処理が完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('エラーが発生しました:', error)
    process.exit(1)
  })

