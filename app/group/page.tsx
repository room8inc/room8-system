import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GroupManagement from './group-management'

export default async function GroupPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // このユーザーのグループメンバーシップを取得
  const { data: membership } = await supabase
    .from('group_members')
    .select(`
      id, role, status,
      group_plans!inner(
        id, name, group_type, status,
        group_slots(id, slot_number, plan_id, plan_type, plans(name, workspace_price, shared_office_price)),
        group_members(id, user_id, role, status, users(id, name, email))
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('group_plans.status', 'active')
    .maybeSingle()

  if (!membership) {
    return (
      <div className="min-h-screen bg-room-base">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link
              href="/dashboard"
              className="text-sm text-room-main hover:text-room-main-light"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
          <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-8 text-center">
            <p className="text-room-charcoal-light">
              グループプランに加入していません
            </p>
          </div>
        </div>
      </div>
    )
  }

  const group = membership.group_plans as any
  const isOwnerOrAdmin = ['owner', 'admin'].includes(membership.role)
  const members = (group.group_members || []).filter(
    (m: any) => m.status === 'active'
  )
  const slots = (group.group_slots || []).sort(
    (a: any, b: any) => a.slot_number - b.slot_number
  )

  // 現在のチェックイン状況を取得
  const { data: activeCheckins } = await supabase
    .from('checkins')
    .select('id, user_id, group_slot_id, checkin_at, users(name)')
    .eq('group_plan_id', group.id)
    .is('checkout_at', null)

  const checkins = (activeCheckins || []).map((c: any) => ({
    ...c,
    users: Array.isArray(c.users) ? c.users[0] || null : c.users,
  }))

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>

        <GroupManagement
          group={group}
          members={members}
          slots={slots}
          checkins={checkins}
          isOwnerOrAdmin={isOwnerOrAdmin}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}
