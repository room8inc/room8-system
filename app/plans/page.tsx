import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlanTypeSelector } from './plan-type-selector'
import { PlanList } from './plan-list'

export default async function PlansPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // プラン一覧を取得
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  // 現在のプラン契約を取得
  const { data: currentPlan } = await supabase
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .single()

  // プランをシェアオフィスとワークスペースに分類
  const sharedOfficePlans = plans?.filter((plan) => {
    const features = plan.features as any
    return features?.type === 'shared_office'
  }) || []

  const coworkingPlans = plans?.filter((plan) => {
    const features = plan.features as any
    return features?.type === 'coworking'
  }) || []

  // プラン種類が指定されている場合は、プラン一覧を表示
  const planType = searchParams.type as 'shared_office' | 'coworking' | undefined

  if (planType) {
    const selectedPlans = planType === 'shared_office' ? sharedOfficePlans : coworkingPlans
    return (
      <PlanList
        planType={planType}
        plans={selectedPlans}
        currentPlan={currentPlan}
        error={plansError}
      />
    )
  }

  // プラン種類選択画面
  return (
    <PlanTypeSelector
      sharedOfficePlans={sharedOfficePlans}
      coworkingPlans={coworkingPlans}
      currentPlan={currentPlan}
      error={plansError}
    />
  )
}
