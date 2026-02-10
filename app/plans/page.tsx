import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanList } from './plan-list'

export default async function PlansPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ユーザー情報を取得（利用者チェックのため）
  const { data: userData } = await supabase
    .from('users')
    .select('is_staff')
    .eq('id', user.id)
    .single()

  // 利用者ユーザーはプラン変更不可
  if (userData?.is_staff === true) {
    redirect('/dashboard')
  }

  // 新6ベースプランのみ取得（旧シェアオフィスプラン：entrepreneur, light, fulltimeを除外）
  const BASE_PLAN_CODES = ['daytime', 'night', 'holiday', 'weekday', 'night_holiday', 'regular']
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .in('code', BASE_PLAN_CODES)
    .order('display_order', { ascending: true })

  // 現在のプラン契約を取得
  const { data: currentPlan } = await supabase
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .single()

  return (
    <PlanList
      plans={plans || []}
      currentPlan={currentPlan}
      error={plansError}
    />
  )
}
