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

  // チェックインがプラン時間前の場合（10分の猶予を考慮）
  if (checkinTimeMinutes < startTimeMinutes) {
    const earlyMinutes = startTimeMinutes - checkinTimeMinutes
    // 10分以内なら課金なし（カウント開始しない）
    if (earlyMinutes > 10) {
      // 10分超えたら、超過分をそのまま計算（10分差し引かない）
      overtimeMinutes += earlyMinutes
    }
  }

  // チェックアウトがプラン時間後の場合
  if (checkoutTimeMinutes > endTimeMinutes) {
    const overtime = checkoutTimeMinutes - endTimeMinutes
    // 10分以内なら課金なし（プラン終了時刻でチェックアウトしたことにする）
    // 例: 17:00終了プランで17:10まで → 課金なし
    // 例: 22:00終了プランで22:10まで → 課金なし
    if (overtime <= 10) {
      // チェックインがプラン時間前の場合の時間外利用はそのまま加算
      if (overtimeMinutes > 0) {
        // 料金を計算（30分単位で切り上げ）
        const fee = calculateOvertimeFee(overtimeMinutes)
        return {
          isOvertime: true,
          overtimeMinutes,
          overtimeFee: fee,
        }
      }
      return {
        isOvertime: false,
        overtimeMinutes: 0,
        overtimeFee: 0,
      }
    }
    // 10分超えたら、超過分をそのままカウント（10分差し引かない）
    // 例: 17:00終了プランで17:11 → 11分使用 → 200円、18:00 → 60分使用 → 400円
    // 例: 22:00終了プランで22:11 → 11分使用 → 200円、23:00 → 60分使用 → 400円
    overtimeMinutes += overtime
  }

  // 時間外利用がない場合は課金なし
  if (overtimeMinutes <= 0) {
    return {
      isOvertime: false,
      overtimeMinutes: 0,
      overtimeFee: 0,
    }
  }

  // 料金を計算（30分単位で切り上げ）
  const fee = calculateOvertimeFee(overtimeMinutes)

  return {
    isOvertime: true,
    overtimeMinutes,
    overtimeFee: fee,
  }
}

/**
 * 時間外利用料金を計算
 * @param overtimeMinutes 時間外利用時間（分、10分の猶予を超えた超過分をそのままカウント）
 * @returns 料金（円）
 * 
 * 計算例（プラン終了17:00の場合）:
 * - 17:11 → 11分 → 30分切り上げ → 200円
 * - 18:00 → 60分 → 60分 → 400円
 * - 19:15 → 135分 → 150分切り上げ → 1000円
 */
export function calculateOvertimeFee(overtimeMinutes: number): number {
  // 30分200円、1時間400円、最大2,000円
  const RATE_30_MIN = 200 // 30分あたりの料金（円）
  const RATE_60_MIN = 400 // 1時間あたりの料金（円）
  const MAX_FEE = 2000 // 最大料金（円）

  // 30分単位で切り上げ
  // 例: 11分 → 1単位、60分 → 2単位、135分 → 5単位
  const chargeable30MinUnits = Math.ceil(overtimeMinutes / 30)
  
  // 料金計算（30分単位）
  let fee = 0
  if (chargeable30MinUnits === 1) {
    // 1-30分 → 200円
    fee = RATE_30_MIN
  } else if (chargeable30MinUnits === 2) {
    // 31-60分 → 400円
    fee = RATE_60_MIN
  } else {
    // 61分以上 → 30分単位で200円追加（最大2,000円）
    // 例: 135分 → 5単位 → 1000円
    fee = Math.min(chargeable30MinUnits * RATE_30_MIN, MAX_FEE)
  }
  
  return fee
}

