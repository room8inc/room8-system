import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import { formatJapaneseName } from '@/lib/utils/name'
import { UserPlanManagement } from './user-plan-management'
import { DeleteUserButton } from './delete-user-button'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 管理者権限チェック
  const admin = await isAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  // paramsを解決
  const { userId } = await params

  const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseAdminUrl || !supabaseAdminKey) {
    throw new Error('Supabase管理者クライアントの環境変数が設定されていません')
  }

  const adminClient = createAdminClient(supabaseAdminUrl, supabaseAdminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // ユーザー情報を取得
  const { data: userData, error: userError } = await adminClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError || !userData) {
    notFound()
  }

  // プラン契約情報を取得
  const {
    data: userPlans,
    error: userPlansError,
  } = await adminClient
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  if (userPlansError) {
    console.error('Admin user detail: failed to fetch user_plans', userPlansError)
  }

  const today = new Date().toISOString().split('T')[0]
  const activePlan = userPlans?.find((plan) => plan.status === 'active' && plan.ended_at === null)
  const scheduledCancellationPlan = userPlans?.find(
    (plan) =>
      plan.status === 'cancelled' &&
      plan.ended_at === null &&
      plan.cancellation_scheduled_date &&
      plan.cancellation_scheduled_date >= today
  )

  const currentPlan = activePlan || scheduledCancellationPlan || null
  const planHistory = userPlans || []

  // プラン一覧を取得（プラン変更用）
  const {
    data: plans,
    error: plansError,
  } = await adminClient
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (plansError) {
    console.error('Admin user detail: failed to fetch plans', plansError)
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ユーザー一覧に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            ユーザー詳細・プラン管理
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            {formatJapaneseName(userData.name)} さんのプラン管理
          </p>
        </div>

        {/* ユーザー基本情報 */}
        <div className="mb-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            基本情報
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-room-charcoal-light">ユーザー名</p>
              <p className="text-sm font-medium text-room-charcoal mt-1">
                {formatJapaneseName(userData.name)}
              </p>
            </div>
            <div>
              <p className="text-xs text-room-charcoal-light">メールアドレス</p>
              <p className="text-sm font-medium text-room-charcoal mt-1">
                {userData.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-room-charcoal-light">会員種別</p>
              <p className="text-sm font-medium text-room-charcoal mt-1">
            {currentPlan
              ? 'Room8会員'
              : userData.member_type === 'regular'
              ? 'Room8会員（契約なし）'
              : 'ドロップイン（非会員）'}
              </p>
            </div>
            <div>
              <p className="text-xs text-room-charcoal-light">登録日</p>
              <p className="text-sm font-medium text-room-charcoal mt-1">
                {new Date(userData.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>
          </div>
        </div>

        {/* プラン管理 */}
        <UserPlanManagement
          userId={userId}
          currentPlan={currentPlan}
          planHistory={planHistory || []}
          plans={plans || []}
        />

        {/* ユーザー削除 */}
        <div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            ユーザー削除
          </h2>
          <p className="text-sm text-room-charcoal-light mb-4">
            このユーザーを完全に削除します。この操作は取り消せません。
            <br />
            ユーザーのプラン契約、チェックイン履歴、会議室予約などの関連データもすべて削除されます。
          </p>
          <DeleteUserButton userId={userId} userName={formatJapaneseName(userData.name)} />
        </div>
      </div>
    </div>
  )
}

