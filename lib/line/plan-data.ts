import { createServiceClient } from '@/lib/supabase/service-client'
import type { PlanInfo, TimeSlot } from './types'

// ============================================
// DB plan code -> LINE Bot TimeSlot mapping
// ============================================

const CODE_TO_TIMESLOT: Record<string, TimeSlot> = {
  daytime: 'day',
  night: 'night',
  holiday: 'weekend',
  weekday: 'weekday',
  night_holiday: 'night-weekend',
  regular: 'regular',
}

// ============================================
// Fallback hardcoded data (used when DB is unavailable)
// ============================================

const FALLBACK_PLANS: Record<string, PlanInfo> = {
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

const FALLBACK_DROPIN = {
  hourly: 420,
  dailyMax: 2200,
}

// ============================================
// Cache
// ============================================

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CacheEntry<T> {
  data: T
  fetchedAt: number
}

let plansCache: CacheEntry<Record<string, PlanInfo>> | null = null
let dropinCache: CacheEntry<{ hourly: number; dailyMax: number }> | null = null

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

// ============================================
// Time range formatting
// ============================================

function formatTime(time: string | null): string {
  if (!time) return ''
  // "09:00:00" or "09:00" -> "9:00"
  const [h, m] = time.split(':')
  return `${parseInt(h)}:00`
}

function buildTimeRange(
  weekdayStart: string | null,
  weekdayEnd: string | null,
  weekendStart: string | null,
  weekendEnd: string | null,
): string {
  const hasWeekday = weekdayStart && weekdayEnd
  const hasWeekend = weekendStart && weekendEnd

  if (hasWeekday && hasWeekend) {
    const wdRange = `${formatTime(weekdayStart)}\u301C${formatTime(weekdayEnd)}`
    const weRange = `${formatTime(weekendStart)}\u301C${formatTime(weekendEnd)}`
    if (wdRange === weRange) {
      return `全営業時間（平日${wdRange} / 土日祝${weRange}）`
    }
    return `平日${wdRange} + 土日祝${weRange}`
  }

  if (hasWeekday) {
    return `平日 ${formatTime(weekdayStart)}\u301C${formatTime(weekdayEnd)}`
  }

  if (hasWeekend) {
    return `土日祝 ${formatTime(weekendStart)}\u301C${formatTime(weekendEnd)}`
  }

  return ''
}

// ============================================
// DB fetch functions
// ============================================

export async function fetchPlansFromDB(): Promise<Record<string, PlanInfo>> {
  if (isCacheValid(plansCache)) {
    return plansCache.data
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('plans')
      .select('code, name, workspace_price, shared_office_price, weekday_start_time, weekday_end_time, weekend_start_time, weekend_end_time')
      .not('workspace_price', 'is', null)

    if (error || !data || data.length === 0) {
      console.error('[LINE plan-data] Failed to fetch plans from DB:', error)
      return FALLBACK_PLANS
    }

    const plans: Record<string, PlanInfo> = {}
    for (const row of data) {
      const timeSlot = CODE_TO_TIMESLOT[row.code]
      if (!timeSlot) continue // skip plans not relevant to LINE Bot (e.g. entrepreneur, fulltime, light)

      plans[timeSlot] = {
        key: timeSlot,
        name: row.name.replace('プラン', ''),
        timeRange: buildTimeRange(
          row.weekday_start_time,
          row.weekday_end_time,
          row.weekend_start_time,
          row.weekend_end_time,
        ),
        workspacePrice: row.workspace_price,
        shareOfficePrice: row.shared_office_price,
      }
    }

    // Validate we have all 6 expected plans
    const expectedKeys: TimeSlot[] = ['day', 'night', 'weekend', 'weekday', 'night-weekend', 'regular']
    const missingKeys = expectedKeys.filter(k => !plans[k])
    if (missingKeys.length > 0) {
      console.warn('[LINE plan-data] Missing plans from DB, using fallback for:', missingKeys)
      for (const key of missingKeys) {
        plans[key] = FALLBACK_PLANS[key]
      }
    }

    plansCache = { data: plans, fetchedAt: Date.now() }
    return plans
  } catch (err) {
    console.error('[LINE plan-data] Exception fetching plans:', err)
    return FALLBACK_PLANS
  }
}

export async function fetchDropinRates(): Promise<{ hourly: number; dailyMax: number }> {
  if (isCacheValid(dropinCache)) {
    return dropinCache.data
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('dropin_rates')
      .select('rate_type, amount')
      .eq('is_active', true)

    if (error || !data || data.length === 0) {
      console.error('[LINE plan-data] Failed to fetch dropin rates from DB:', error)
      return FALLBACK_DROPIN
    }

    const rates = { ...FALLBACK_DROPIN }
    for (const row of data) {
      if (row.rate_type === 'hourly') rates.hourly = row.amount
      if (row.rate_type === 'daily_max') rates.dailyMax = row.amount
    }

    dropinCache = { data: rates, fetchedAt: Date.now() }
    return rates
  } catch (err) {
    console.error('[LINE plan-data] Exception fetching dropin rates:', err)
    return FALLBACK_DROPIN
  }
}
