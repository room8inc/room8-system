import type { PlanInfo, TimeSlot, NeedsAddress } from './types'

const PLANS: Record<string, PlanInfo> = {
  weekend: {
    key: 'weekend',
    name: 'ホリデー',
    timeRange: '土日祝 9:00〜17:00',
    basePrice: 6600,
    addressPrice: 9900,
  },
  night: {
    key: 'night',
    name: 'ナイト',
    timeRange: '平日 17:00〜22:00',
    basePrice: 6600,
    addressPrice: 9900,
  },
  day: {
    key: 'day',
    name: 'デイタイム',
    timeRange: '平日 9:00〜17:00',
    basePrice: 11000,
    addressPrice: 14300,
  },
  'night-weekend': {
    key: 'night-weekend',
    name: 'ナイト&ホリデー',
    timeRange: '平日17:00〜22:00 + 土日祝9:00〜17:00',
    basePrice: 9900,
    addressPrice: 13200,
  },
  weekday: {
    key: 'weekday',
    name: 'ウィークデイ',
    timeRange: '平日 9:00〜22:00',
    basePrice: 13200,
    addressPrice: 16500,
  },
  regular: {
    key: 'regular',
    name: 'レギュラー',
    timeRange: '全営業時間（平日9:00〜22:00 / 土日祝9:00〜17:00）',
    basePrice: 16500,
    addressPrice: 19800,
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
    return `${formatPrice(plan.addressPrice)}/月（住所利用込み）`
  }
  if (needsAddress === 'no') {
    return `${formatPrice(plan.basePrice)}/月`
  }
  // unknown
  return `${formatPrice(plan.basePrice)}/月〜（住所利用: ${formatPrice(plan.addressPrice)}/月）`
}
