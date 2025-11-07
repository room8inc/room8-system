/**
 * 解約料金計算ロジック
 * 
 * 長期契約割引（年契約）の場合：
 * - 半年（6ヶ月）までは100%返金が必要
 * - それ以降は50%返金が必要
 * 
 * 計算式：
 * - 月額割引額 = プラン価格 × (1 - 年契約割引率)
 * - 年契約割引率 = 20% (0.2)
 * - 月額割引額 = プラン価格 × 0.2
 * 
 * 例：会費10,000円の場合
 * - 月額割引額 = 10,000 × 0.2 = 2,000円
 * - 3ヶ月でやめた場合：3 × 2,000 = 6,000円（100%）
 * - 6ヶ月：6 × 2,000 = 12,000円（100%）
 * - 7ヶ月：7 × 2,000 × 0.5 = 7,000円（50%）
 * - 11ヶ月：11 × 2,000 × 0.5 = 11,000円（50%）
 */

interface CancellationFeeParams {
  planPrice: number // プラン価格（円）
  contractTerm: 'monthly' | 'yearly' // 契約期間
  startedAt: string | Date // 契約開始日
  cancellationDate: string | Date // 解約日
}

interface CancellationFeeResult {
  fee: number // 解約料金（円）
  monthsUsed: number // 利用月数
  discountPerMonth: number // 月額割引額
  refundRate: number // 返金率（1.0 = 100%, 0.5 = 50%）
}

const YEARLY_DISCOUNT_RATE = 0.2 // 年契約割引率（20%）
const HALF_YEAR_MONTHS = 6 // 半年（6ヶ月）

export function calculateCancellationFee({
  planPrice,
  contractTerm,
  startedAt,
  cancellationDate,
}: CancellationFeeParams): CancellationFeeResult {
  // 月契約の場合は解約料金なし
  if (contractTerm === 'monthly') {
    return {
      fee: 0,
      monthsUsed: 0,
      discountPerMonth: 0,
      refundRate: 0,
    }
  }

  // 年契約の場合のみ解約料金を計算
  const startDate = new Date(startedAt)
  const cancelDate = new Date(cancellationDate)

  // 利用月数を計算（開始月から解約月まで）
  // より正確な計算：年と月の差分を使用
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()
  const cancelYear = cancelDate.getFullYear()
  const cancelMonth = cancelDate.getMonth()
  
  const monthsUsed = (cancelYear - startYear) * 12 + (cancelMonth - startMonth) + 1

  // 月額割引額を計算
  const discountPerMonth = Math.floor(planPrice * YEARLY_DISCOUNT_RATE)

  // 返金率を決定（半年までは100%、それ以降は50%）
  const refundRate = monthsUsed <= HALF_YEAR_MONTHS ? 1.0 : 0.5

  // 解約料金を計算
  const fee = Math.floor(monthsUsed * discountPerMonth * refundRate)

  return {
    fee,
    monthsUsed,
    discountPerMonth,
    refundRate,
  }
}

