export type PlanRecord = {
  id: string
  status: string
  started_at: string
  ended_at: string | null
  cancellation_scheduled_date: string | null
  [key: string]: any
}

export interface NormalizedPlanRecord extends PlanRecord {
  currentPlanDetail: any | null
  newPlanDetail: any | null
  plans: any | null
}

const isPlanRecord = (plan: any): plan is PlanRecord => {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof plan.status === 'string' &&
    typeof plan.started_at === 'string' &&
    'ended_at' in plan &&
    'cancellation_scheduled_date' in plan
  )
}

const normalizePlanRecord = (plan: PlanRecord): NormalizedPlanRecord => {
  const currentPlanDetail = plan.plans ?? null
  const newPlanDetail = plan.new_plans ?? null

  return {
    ...plan,
    currentPlanDetail,
    newPlanDetail,
    plans: currentPlanDetail ?? newPlanDetail ?? null,
  }
}

export function normalizeUserPlans(userPlans: any, todayStr?: string) {
  const today = todayStr ?? new Date().toISOString().split('T')[0]

  const isFutureOrToday = (date: string | null | undefined) => {
    if (!date) return false
    return date >= today
  }

  const records = Array.isArray(userPlans) ? userPlans : []
  const typedRecords = records.reduce<PlanRecord[]>((acc, plan) => {
    if (isPlanRecord(plan)) {
      acc.push(plan)
    }
    return acc
  }, [])

  const normalizedRecords = typedRecords.map(normalizePlanRecord)

  const activePlan =
    normalizedRecords.find((plan) => {
      if (plan.status !== 'active') return false
      if (plan.ended_at === null) return true
      return isFutureOrToday(plan.ended_at)
    }) ?? null

  const scheduledCancellationPlan =
    normalizedRecords.find((plan) => {
      if (plan.status !== 'cancelled') return false
      if (isFutureOrToday(plan.cancellation_scheduled_date)) return true
      if (isFutureOrToday(plan.ended_at)) return true
      return false
    }) ?? null

  const currentPlan = activePlan || scheduledCancellationPlan

  return {
    currentPlan,
    planHistory: normalizedRecords,
    activePlan,
    scheduledCancellationPlan,
  }
}


