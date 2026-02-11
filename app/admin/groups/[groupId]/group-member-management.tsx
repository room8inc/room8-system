'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatJapaneseName } from '@/lib/utils/name'

type Member = {
  id: string
  user_id: string
  role: string
  status: string
  users: { id: string; name: string; email: string } | null
}

type User = {
  id: string
  name: string
  email: string
}

export default function GroupMemberManagement({
  groupId,
  members,
  allUsers,
}: {
  groupId: string
  members: Member[]
  allUsers: User[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('member')

  const memberUserIds = new Set(members.map((m) => m.user_id))
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id))

  const handleAddMember = async () => {
    if (!selectedUserId) return
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }

      setShowAddMember(false)
      setSelectedUserId('')
      router.refresh()
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }

      router.refresh()
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('このメンバーを削除しますか？')) return
    setLoading(true)

    try {
      const res = await fetch(
        `/api/admin/groups/${groupId}/members?memberId=${memberId}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }

      router.refresh()
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'オーナー',
    admin: '管理者',
    member: 'メンバー',
  }

  const roleStyles: Record<string, string> = {
    owner: 'bg-room-main text-white',
    admin: 'bg-blue-100 text-blue-800',
    member: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="mb-6 rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-room-charcoal">
          メンバー管理
        </h2>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="rounded-md bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light"
        >
          メンバー追加
        </button>
      </div>

      {/* メンバー追加フォーム */}
      {showAddMember && (
        <div className="mb-4 rounded bg-room-base p-4 border border-room-base-dark">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-room-charcoal-light mb-1">
                ユーザー
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded border border-room-base-dark px-2 py-1.5 text-sm"
              >
                <option value="">選択してください</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatJapaneseName(u.name)} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-room-charcoal-light mb-1">
                ロール
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="rounded border border-room-base-dark px-2 py-1.5 text-sm"
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <button
              onClick={handleAddMember}
              disabled={loading || !selectedUserId}
              className="rounded bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>
      )}

      {/* メンバー一覧 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-room-base-dark">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-room-charcoal-light">
                名前
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-room-charcoal-light">
                メール
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-room-charcoal-light">
                ロール
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-room-charcoal-light">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-room-base-dark">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 text-sm text-room-charcoal">
                  {member.users
                    ? formatJapaneseName(member.users.name)
                    : '不明'}
                </td>
                <td className="px-4 py-3 text-sm text-room-charcoal-light">
                  {member.users?.email || '---'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                      roleStyles[member.role] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {roleLabels[member.role] || member.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {member.role !== 'owner' && (
                    <div className="flex gap-2">
                      <select
                        defaultValue={member.role}
                        onChange={(e) =>
                          handleChangeRole(member.id, e.target.value)
                        }
                        disabled={loading}
                        className="rounded border border-room-base-dark px-1 py-0.5 text-xs"
                      >
                        <option value="admin">管理者</option>
                        <option value="member">メンバー</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
