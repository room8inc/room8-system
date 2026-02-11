import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import GroupSlotManagement from './group-slot-management'
import GroupMemberManagement from './group-member-management'

type PageProps = {
  params: Promise<{ groupId: string }>
}

export default async function AdminGroupDetailPage({ params }: PageProps) {
  const { groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await isAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  // グループ詳細を取得
  const { data: group, error } = await supabase
    .from('group_plans')
    .select(`
      *,
      owner:users!group_plans_owner_user_id_fkey(id, name, email),
      group_slots(id, slot_number, plan_id, plan_type, options, stripe_subscription_item_id, plans(*)),
      group_members(id, user_id, role, status, users(id, name, email))
    `)
    .eq('id', groupId)
    .single()

  if (error || !group) {
    redirect('/admin/groups')
  }

  // 現在のチェックイン状況を取得
  const { data: activeCheckins } = await supabase
    .from('checkins')
    .select('id, user_id, group_slot_id, checkin_at, users(name)')
    .eq('group_plan_id', groupId)
    .is('checkout_at', null)

  // プラン一覧を取得（スロット追加用）
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code, workspace_price, shared_office_price')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  // ユーザー一覧を取得（メンバー追加用）
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('status', 'active')
    .order('name', { ascending: true })

  const slots = ((group.group_slots as any[]) || []).sort(
    (a: any, b: any) => a.slot_number - b.slot_number
  )
  const members = ((group.group_members as any[]) || []).filter(
    (m: any) => m.status === 'active'
  )
  const checkins = (activeCheckins || []).map((c: any) => ({
    ...c,
    users: Array.isArray(c.users) ? c.users[0] || null : c.users,
  }))

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin/groups"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← グループ一覧に戻る
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-room-charcoal">
                {group.name}
              </h1>
              <p className="mt-1 text-sm text-room-charcoal-light">
                {group.group_type === 'family' ? '家族' : '法人'}グループ
                ・ オーナー: {(group.owner as any)?.name || '不明'}
                ・ ステータス:{' '}
                <span
                  className={`font-medium ${
                    group.status === 'active'
                      ? 'text-green-600'
                      : group.status === 'cancelled'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}
                >
                  {group.status === 'active'
                    ? '有効'
                    : group.status === 'cancelled'
                    ? '解約済'
                    : '停止中'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* グループ基本情報 */}
        <div className="mb-6 rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            基本情報
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-room-charcoal-light">契約種別</dt>
              <dd className="text-sm font-medium text-room-charcoal">
                {group.contract_term === 'yearly' ? '年契約' : '月契約'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-room-charcoal-light">
                Stripeサブスクリプション
              </dt>
              <dd className="text-sm font-medium text-room-charcoal">
                {group.stripe_subscription_id || '未作成'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-room-charcoal-light">作成日</dt>
              <dd className="text-sm font-medium text-room-charcoal">
                {new Date(group.created_at).toLocaleDateString('ja-JP')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-room-charcoal-light">
                オーナーメール
              </dt>
              <dd className="text-sm font-medium text-room-charcoal">
                {(group.owner as any)?.email || '不明'}
              </dd>
            </div>
          </dl>
        </div>

        {/* スロット管理 */}
        <GroupSlotManagement
          groupId={groupId}
          slots={slots}
          checkins={checkins}
          plans={plans || []}
          hasSubscription={!!group.stripe_subscription_id}
        />

        {/* メンバー管理 */}
        <GroupMemberManagement
          groupId={groupId}
          members={members}
          allUsers={allUsers || []}
        />

        {/* Stripeセクション */}
        <div className="mt-6 rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            Stripe連携
          </h2>
          {group.stripe_subscription_id ? (
            <div className="text-sm text-room-charcoal">
              <p>
                サブスクリプションID:{' '}
                <code className="bg-room-base-dark px-1 py-0.5 rounded text-xs">
                  {group.stripe_subscription_id}
                </code>
              </p>
            </div>
          ) : (
            <SubscriptionCreateButton groupId={groupId} />
          )}
        </div>
      </div>
    </div>
  )
}

function SubscriptionCreateButton({ groupId }: { groupId: string }) {
  return (
    <form
      action={async () => {
        'use server'
        // サブスクリプション作成はクライアントコンポーネントで処理
      }}
    >
      <p className="mb-3 text-sm text-room-charcoal-light">
        サブスクリプションが未作成です。作成するとStripeで定期決済が開始されます。
      </p>
      <CreateSubscriptionClientButton groupId={groupId} />
    </form>
  )
}

// クライアントコンポーネントとしてインポート
import CreateSubscriptionClientButton from './create-subscription-button'
