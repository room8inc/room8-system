import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MemberManagement } from './member-management'

export default async function MembersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // メイン会員のアクティブな契約を確認
  const { data: hostPlan } = await supabase
    .from('user_plans')
    .select('id, plan_id, plan_type, plans:plan_id(id, name, workspace_price, shared_office_price)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .is('invited_by', null)
    .maybeSingle()

  if (!hostPlan) {
    return (
      <div className="min-h-screen bg-room-base">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link
              href="/dashboard"
              className="text-sm text-room-main hover:text-room-main-light"
            >
              &larr; ダッシュボードに戻る
            </Link>
          </div>
          <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-8 text-center">
            <p className="text-room-charcoal-light">
              メンバーを招待するには、先にプランを契約してください。
            </p>
            <Link
              href="/plans"
              className="mt-4 inline-block rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
            >
              プランを選択する
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 選択可能なプラン一覧を取得（メイン会員のプラン価格以下のもの）
  const hostPlanData = Array.isArray(hostPlan.plans) ? hostPlan.plans[0] : hostPlan.plans
  const hostPrice = hostPlan.plan_type === 'shared_office'
    ? hostPlanData?.shared_office_price
    : hostPlanData?.workspace_price

  const BASE_PLAN_CODES = ['daytime', 'night', 'holiday', 'weekday', 'night_holiday', 'fulltime']
  const { data: plans } = await supabase
    .from('plans')
    .select('id, code, name, workspace_price, shared_office_price')
    .eq('is_active', true)
    .in('code', BASE_PLAN_CODES)
    .order('display_order', { ascending: true })

  // ホストのプラン価格以下のプランのみフィルタ
  const availablePlans = (plans || []).filter(
    (p) => !hostPrice || (p.workspace_price || 0) <= hostPrice
  )

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            &larr; ダッシュボードに戻る
          </Link>
        </div>

        <MemberManagement
          hostPlanName={hostPlanData?.name || 'プラン不明'}
          availablePlans={availablePlans}
        />
      </div>
    </div>
  )
}
