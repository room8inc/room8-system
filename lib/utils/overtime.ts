/**
 * 時間外利用の計算ロジック
 */

/** @deprecated 旧インターフェース。新コードではPlanTimeInfoを使用すること */
export interface PlanInfo {
  startTime?: string // "HH:MM:SS" 形式
  endTime?: string // "HH:MM:SS" 形式
  availableDays?: string[] // ['monday', 'tuesday', ...]
}

export interface PlanTimeInfo {
  weekdayStartTime?: string | null // "HH:MM:SS" 形式、NULLなら平日利用不可
  weekdayEndTime?: string | null
  weekendStartTime?: string | null // "HH:MM:SS" 形式、NULLなら週末利用不可
  weekendEndTime?: string | null
}

export interface OvertimeResult {
  isOvertime: boolean
  overtimeMinutes: number
  overtimeFee: number
}

/**
 * 曜日が土日かどうかを判定
 */
function isWeekendDay(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // 0=日曜, 6=土曜
}

/**
 * 指定日の利用可能時間帯を取得
 * @returns [startTimeMinutes, endTimeMinutes] or null（利用不可日）
 */
function getAvailableTimeRange(
  date: Date,
  planTimeInfo: PlanTimeInfo
): [number, number] | null {
  const weekend = isWeekendDay(date)

  const startTimeStr = weekend ? planTimeInfo.weekendStartTime : planTimeInfo.weekdayStartTime
  const endTimeStr = weekend ? planTimeInfo.weekendEndTime : planTimeInfo.weekdayEndTime

  if (!startTimeStr || !endTimeStr) {
    return null // この日は利用不可
  }

  const [startHour, startMinute] = startTimeStr.substring(0, 5).split(':').map(Number)
  const [endHour, endMinute] = endTimeStr.substring(0, 5).split(':').map(Number)

  return [startHour * 60 + startMinute, endHour * 60 + endMinute]
}

/**
 * 時間外利用を計算
 * @param checkinAt チェックイン時刻
 * @param checkoutAt チェックアウト時刻
 * @param planInfo プラン情報（新: PlanTimeInfo、旧: PlanInfo も後方互換で受け付ける）
 * @returns 時間外利用の結果
 */
export function calculateOvertime(
  checkinAt: Date,
  checkoutAt: Date,
  planInfo: PlanTimeInfo | PlanInfo | null
): OvertimeResult {
  if (!planInfo) {
    return { isOvertime: false, overtimeMinutes: 0, overtimeFee: 0 }
  }

  // 旧PlanInfo形式を新PlanTimeInfo形式に変換
  let timeInfo: PlanTimeInfo
  if ('weekdayStartTime' in planInfo || 'weekdayEndTime' in planInfo || 'weekendStartTime' in planInfo || 'weekendEndTime' in planInfo) {
    timeInfo = planInfo as PlanTimeInfo
  } else {
    const legacy = planInfo as PlanInfo
    if (!legacy.startTime || !legacy.endTime) {
      return { isOvertime: false, overtimeMinutes: 0, overtimeFee: 0 }
    }
    // 旧形式: availableDaysで平日/週末の利用可否を判断
    const weekdayDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    const weekendDays = ['saturday', 'sunday']
    const hasWeekday = !legacy.availableDays || weekdayDays.some(d => legacy.availableDays!.includes(d))
    const hasWeekend = !legacy.availableDays || weekendDays.some(d => legacy.availableDays!.includes(d))
    timeInfo = {
      weekdayStartTime: hasWeekday ? legacy.startTime : null,
      weekdayEndTime: hasWeekday ? legacy.endTime : null,
      weekendStartTime: hasWeekend ? legacy.startTime : null,
      weekendEndTime: hasWeekend ? legacy.endTime : null,
    }
  }

  // チェックイン日の利用可能時間帯を取得
  const timeRange = getAvailableTimeRange(checkinAt, timeInfo)

  // 利用不可日の場合は全時間が時間外
  if (!timeRange) {
    const totalMinutes = Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / (1000 * 60))
    const fee = calculateOvertimeFee(totalMinutes)
    return { isOvertime: true, overtimeMinutes: totalMinutes, overtimeFee: fee }
  }

  const [startTimeMinutes, endTimeMinutes] = timeRange

  // チェックイン・チェックアウト時刻を分単位に変換
  const checkinTimeMinutes = checkinAt.getHours() * 60 + checkinAt.getMinutes()
  const checkoutTimeMinutes = checkoutAt.getHours() * 60 + checkoutAt.getMinutes()

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
    if (overtime <= 10) {
      // チェックインがプラン時間前の場合の時間外利用はそのまま加算
      if (overtimeMinutes > 0) {
        const fee = calculateOvertimeFee(overtimeMinutes)
        return { isOvertime: true, overtimeMinutes, overtimeFee: fee }
      }
      return { isOvertime: false, overtimeMinutes: 0, overtimeFee: 0 }
    }
    // 10分超えたら、超過分をそのままカウント（10分差し引かない）
    overtimeMinutes += overtime
  }

  // 時間外利用がない場合は課金なし
  if (overtimeMinutes <= 0) {
    return { isOvertime: false, overtimeMinutes: 0, overtimeFee: 0 }
  }

  // 料金を計算（30分単位で切り上げ）
  const fee = calculateOvertimeFee(overtimeMinutes)

  return { isOvertime: true, overtimeMinutes, overtimeFee: fee }
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

