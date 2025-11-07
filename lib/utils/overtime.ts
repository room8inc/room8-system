/**
 * 時間外利用の計算ロジック
 */

export interface PlanInfo {
  startTime?: string // "HH:MM:SS" 形式
  endTime?: string // "HH:MM:SS" 形式
  availableDays?: string[] // ['monday', 'tuesday', ...]
}

export interface OvertimeResult {
  isOvertime: boolean
  overtimeMinutes: number
  overtimeFee: number
}

/**
 * 時間外利用を計算
 * @param checkinAt チェックイン時刻
 * @param checkoutAt チェックアウト時刻
 * @param planInfo プラン情報
 * @returns 時間外利用の結果
 */
export function calculateOvertime(
  checkinAt: Date,
  checkoutAt: Date,
  planInfo: PlanInfo | null
): OvertimeResult {
  // プラン情報がない場合は時間外利用なし
  if (!planInfo || !planInfo.startTime || !planInfo.endTime) {
    return {
      isOvertime: false,
      overtimeMinutes: 0,
      overtimeFee: 0,
    }
  }

  // プランの利用可能時間を取得
  const startTimeStr = planInfo.startTime.substring(0, 5) // "HH:MM"
  const endTimeStr = planInfo.endTime.substring(0, 5) // "HH:MM"
  
  const [startHour, startMinute] = startTimeStr.split(':').map(Number)
  const [endHour, endMinute] = endTimeStr.split(':').map(Number)
  const startTimeMinutes = startHour * 60 + startMinute
  const endTimeMinutes = endHour * 60 + endMinute

  // チェックイン・チェックアウト時刻を分単位に変換
  const checkinTimeMinutes = checkinAt.getHours() * 60 + checkinAt.getMinutes()
  const checkoutTimeMinutes = checkoutAt.getHours() * 60 + checkoutAt.getMinutes()

  // 日付が異なる場合は考慮が必要（簡易版では同日のみ）
  const checkinDay = checkinAt.getDay() // 0=日曜, 1=月曜, ..., 6=土曜
  const checkoutDay = checkoutAt.getDay()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const checkinDayName = dayNames[checkinDay]
  const checkoutDayName = dayNames[checkoutDay]

  // 利用可能日かチェック
  const isCheckinAvailableDay = planInfo.availableDays?.includes(checkinDayName) ?? true
  const isCheckoutAvailableDay = planInfo.availableDays?.includes(checkoutDayName) ?? true

  // 利用可能日でない場合は時間外利用として扱う（簡易版）
  if (!isCheckinAvailableDay || !isCheckoutAvailableDay) {
    // 全日利用として計算（簡易版）
    const totalMinutes = Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / (1000 * 60))
    const fee = calculateOvertimeFee(totalMinutes)
    return {
      isOvertime: true,
      overtimeMinutes: totalMinutes,
      overtimeFee: fee,
    }
  }

  // プラン時間内の利用時間を計算
  let overtimeMinutes = 0

  // チェックインがプラン時間前の場合
  if (checkinTimeMinutes < startTimeMinutes) {
    overtimeMinutes += startTimeMinutes - checkinTimeMinutes
  }

  // チェックアウトがプラン時間後の場合
  if (checkoutTimeMinutes > endTimeMinutes) {
    const overtime = checkoutTimeMinutes - endTimeMinutes
    // 10分の猶予を考慮
    const chargeableMinutes = Math.max(0, overtime - 10)
    overtimeMinutes += chargeableMinutes
  }

  // 15分未満の場合は課金なし
  if (overtimeMinutes < 15) {
    return {
      isOvertime: false,
      overtimeMinutes: 0,
      overtimeFee: 0,
    }
  }

  // 料金を計算
  const fee = calculateOvertimeFee(overtimeMinutes)

  return {
    isOvertime: true,
    overtimeMinutes,
    overtimeFee: fee,
  }
}

/**
 * 時間外利用料金を計算
 * @param overtimeMinutes 時間外利用時間（分）
 * @returns 料金（円）
 */
export function calculateOvertimeFee(overtimeMinutes: number): number {
  // 30分200円、1時間400円、最大2,000円
  const HOURLY_RATE = 400 // 1時間あたりの料金（円）
  const MAX_FEE = 2000 // 最大料金（円）

  const hours = Math.ceil(overtimeMinutes / 60) // 切り上げ
  return Math.min(hours * HOURLY_RATE, MAX_FEE)
}

