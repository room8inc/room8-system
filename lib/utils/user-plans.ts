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
  isActive: boolean
  isScheduledCancellation: boolean
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

const normalizePlanRecord = (plan: PlanRecord, today: string): NormalizedPlanRecord => {
  const currentPlanDetail = plan.plans ?? null
  const newPlanDetail = plan.new_plans ?? null

  const endedAt = plan.ended_at
  const scheduledDate = plan.cancellation_scheduled_date

  const isFutureOrToday = (date: string | null | undefined) => {
    if (!date) return false
    return date >= today
  }

  const isActive =
    plan.status === 'active' && (endedAt === null || isFutureOrToday(endedAt))

  const isScheduledCancellation =
    (scheduledDate !== null && isFutureOrToday(scheduledDate)) ||
    (plan.status === 'cancelled' && endedAt !== null && isFutureOrToday(endedAt))

  return {
    ...plan,
    currentPlanDetail,
    newPlanDetail,
    plans: currentPlanDetail ?? newPlanDetail ?? null,
    isActive,
    isScheduledCancellation,
  }
}

export function normalizeUserPlans(userPlans: any, todayStr?: string) {
  const today = todayStr ?? new Date().toISOString().split('T')[0]

  const records = Array.isArray(userPlans) ? userPlans : []
  const typedRecords = records.reduce<PlanRecord[]>((acc, plan) => {
    if (isPlanRecord(plan)) {
      acc.push(plan)
    }
    return acc
  }, [])

  const normalizedRecords = typedRecords.map((plan) => normalizePlanRecord(plan, today))

  const activePlan = normalizedRecords.find((plan) => plan.isActive) ?? null
  const scheduledCancellationPlan =
    normalizedRecords.find((plan) => plan.isScheduledCancellation) ?? null

  const currentPlan = activePlan || scheduledCancellationPlan

  return {
    currentPlan,
    planHistory: normalizedRecords,
    activePlan,
    scheduledCancellationPlan,
  }
}


