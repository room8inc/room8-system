import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import { formatJapaneseName } from '@/lib/utils/name'

export default async function AdminGroupsPage() {
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

  const { data: groups, error } = await supabase
    .from('group_plans')
    .select(`
      *,
      owner:users!group_plans_owner_user_id_fkey(id, name, email),
      group_slots(id),
      group_members(id, status)
    `)
    .order('created_at', { ascending: false })

  const groupsWithCounts = (groups || []).map((group: any) => ({
    ...group,
    slotCount: group.group_slots?.length || 0,
    activeMemberCount:
      group.group_members?.filter((m: any) => m.status === 'active').length || 0,
  }))

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← 管理者画面に戻る
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-room-charcoal">
                グループ管理
              </h1>
              <p className="mt-2 text-sm text-room-charcoal-light">
                グループプランの作成・メンバー管理ができます
              </p>
            </div>
            <Link
              href="/admin/groups/new"
              className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
            >
              新規作成
            </Link>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              グループ情報の取得に失敗しました: {error.message}
            </p>
          </div>
        )}

        {/* グループ一覧テーブル */}
        <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-room-base-dark">
              <thead className="bg-room-base-dark">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    グループ名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    種別
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    オーナー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    スロット数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    メンバー数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-room-base-light divide-y divide-room-base-dark">
                {groupsWithCounts.map((group: any) => (
                  <tr key={group.id} className="hover:bg-room-base">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-room-charcoal">
                        {group.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          group.group_type === 'family'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {group.group_type === 'family' ? '家族' : '法人'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-room-charcoal-light">
                        {group.owner
                          ? formatJapaneseName(group.owner.name)
                          : '不明'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-room-charcoal-light">
                        {group.slotCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-room-charcoal-light">
                        {group.activeMemberCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={group.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/admin/groups/${group.id}`}
                        className="text-room-main hover:text-room-main-light"
                      >
                        詳細・編集
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {groupsWithCounts.length === 0 && (
          <div className="rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center mt-4">
            <p className="text-sm text-room-wood-dark">
              グループが登録されていません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    suspended: 'bg-yellow-100 text-yellow-800',
  }
  const labels: Record<string, string> = {
    active: '有効',
    cancelled: '解約済',
    suspended: '停止中',
  }
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        styles[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {labels[status] || status}
    </span>
  )
}
