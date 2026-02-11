import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GroupPlanForm from './group-plan-form'

export default async function GroupPlanPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 既にグループに所属しているか確認
  const { data: existingMembership } = await supabase
    .from('group_members')
    .select('id, group_plans!inner(id, status)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('group_plans.status', 'active')
    .maybeSingle()

  if (existingMembership) {
    redirect('/group')
  }

  // プラン一覧を取得
  const BASE_PLAN_CODES = ['daytime', 'night', 'holiday', 'weekday', 'night_holiday', 'fulltime']
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code, workspace_price, shared_office_price, weekday_start_time, weekday_end_time, weekend_start_time, weekend_end_time')
    .eq('is_active', true)
    .in('code', BASE_PLAN_CODES)
    .order('display_order', { ascending: true })

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/plans"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← プラン一覧に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            グループプラン
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            家族や法人で複数人利用できるプランです。2人目以降は50% OFFになります。
          </p>
        </div>

        <GroupPlanForm plans={plans || []} />
      </div>
    </div>
  )
}
