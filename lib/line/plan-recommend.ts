import type { PlanInfo, TimeSlot, NeedsAddress } from './types'

const PLANS: Record<string, PlanInfo> = {
  weekend: {
    key: 'weekend',
    name: 'ホリデー',
    timeRange: '土日祝 9:00〜17:00',
    workspacePrice: 6600,
    shareOfficePrice: 9900,
  },
  night: {
    key: 'night',
    name: 'ナイト',
    timeRange: '平日 17:00〜22:00',
    workspacePrice: 6600,
    shareOfficePrice: 9900,
  },
  day: {
    key: 'day',
    name: 'デイタイム',
    timeRange: '平日 9:00〜17:00',
    workspacePrice: 11000,
    shareOfficePrice: 14300,
  },
  'night-weekend': {
    key: 'night-weekend',
    name: 'ナイト&ホリデー',
    timeRange: '平日17:00〜22:00 + 土日祝9:00〜17:00',
    workspacePrice: 9900,
    shareOfficePrice: 13200,
  },
  weekday: {
    key: 'weekday',
    name: 'ウィークデイ',
    timeRange: '平日 9:00〜22:00',
    workspacePrice: 13200,
    shareOfficePrice: 16500,
  },
  regular: {
    key: 'regular',
    name: 'レギュラー',
    timeRange: '全営業時間（平日9:00〜22:00 / 土日祝9:00〜17:00）',
    workspacePrice: 16500,
    shareOfficePrice: 19800,
  },
}

const TIME_SLOT_TO_PLAN: Record<TimeSlot, string> = {
  day: 'day',
  night: 'night',
  weekend: 'weekend',
  weekday: 'weekday',
  'night-weekend': 'night-weekend',
  regular: 'regular',
}

export function recommendPlan(timeSlot: TimeSlot): PlanInfo {
  const planKey = TIME_SLOT_TO_PLAN[timeSlot]
  return PLANS[planKey]
}

export function getPlanByKey(key: string): PlanInfo | undefined {
  return PLANS[key]
}

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`
}

export function getPriceDisplay(plan: PlanInfo, needsAddress: NeedsAddress): string {
  if (needsAddress === 'yes') {
    return `${formatPrice(plan.shareOfficePrice)}/月（シェアオフィス）`
  }
  if (needsAddress === 'no') {
    return `${formatPrice(plan.workspacePrice)}/月（ワークスペース）`
  }
  // unknown
  return `${formatPrice(plan.workspacePrice)}/月〜（シェアオフィス: ${formatPrice(plan.shareOfficePrice)}/月）`
}
