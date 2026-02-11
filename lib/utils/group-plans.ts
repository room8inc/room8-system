import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * グループプラン関連のユーティリティ関数
 */

/** ユーザーのアクティブなグループメンバーシップを取得 */
export async function getActiveGroupMembership(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('group_members')
    .select('id, group_plan_id, role, group_plans!inner(id, status)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('group_plans.status', 'active')
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('getActiveGroupMembership error:', error)
    return null
  }

  return data
}

/** チェックイン可能なグループスロットを探す（時間帯チェック込み） */
export async function findAvailableGroupSlot(
  supabase: SupabaseClient,
  groupPlanId: string,
  currentTime: Date
) {
  // 1. group_slotsを全件取得（plan情報joinで時間帯取得）
  const { data: slots, error: slotsError } = await supabase
    .from('group_slots')
    .select('id, slot_number, plan_id, plan_type, plans!inner(*)')
    .eq('group_plan_id', groupPlanId)
    .order('slot_number', { ascending: true })

  if (slotsError || !slots || slots.length === 0) {
    return null
  }

  // 2. 現在チェックイン中のスロットIDを取得
  const { data: activeCheckins } = await supabase
    .from('checkins')
    .select('group_slot_id')
    .eq('group_plan_id', groupPlanId)
    .is('checkout_at', null)

  const occupiedSlotIds = new Set(
    (activeCheckins || []).map((c: any) => c.group_slot_id).filter(Boolean)
  )

  // 3. 空きスロットのうち、isWithinPlanTimeWindow が true のものを返す
  for (const slot of slots) {
    if (occupiedSlotIds.has(slot.id)) continue
    if (isWithinPlanTimeWindow(slot.plans, currentTime)) {
      return slot
    }
  }

  return null
}

/** プランの時間帯チェック */
export function isWithinPlanTimeWindow(plan: any, now: Date): boolean {
  const dayOfWeek = now.getDay() // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  let startTime: string | null
  let endTime: string | null

  if (isWeekend) {
    startTime = plan.weekend_start_time
    endTime = plan.weekend_end_time
  } else {
    startTime = plan.weekday_start_time
    endTime = plan.weekday_end_time
  }

  // 時間帯がnullの場合はその曜日は利用不可
  if (!startTime || !endTime) return false

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

/** スロットのプランがオーナーのプラン以下か検証 */
export function isSlotPlanAllowed(
  ownerPlanPrice: number,
  slotPlanPrice: number
): boolean {
  return slotPlanPrice <= ownerPlanPrice
}

function timeToMinutes(time: string): number {
  const parts = time.split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}
