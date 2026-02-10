import type { PlanInfo, TimeSlot, NeedsAddress } from './types'
import { fetchPlansFromDB } from './plan-data'

export async function recommendPlan(timeSlot: TimeSlot): Promise<PlanInfo> {
  const plans = await fetchPlansFromDB()
  return plans[timeSlot]
}

export async function getPlanByKey(key: string): Promise<PlanInfo | undefined> {
  const plans = await fetchPlansFromDB()
  return plans[key]
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
