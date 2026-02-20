'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatJapaneseName } from '@/lib/utils/name'

interface UserWithFlags {
  id: string
  name: string
  email: string
  member_type: string
  is_admin: boolean
  has_shared_office: boolean
  stripe_customer_id: string | null
  created_at: string
}

interface UserTableProps {
  users: UserWithFlags[]
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-1 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${checked ? 'bg-room-main' : 'bg-room-base-dark'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function UserTable({ users: initialUsers }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  const filteredUsers = users.filter((u) => {
    if (filter === 'all') return true
    if (filter === 'member') return u.member_type === 'regular'
    if (filter === 'non-member') return u.member_type !== 'regular'
    return true
  })

  const memberCount = users.filter((u) => u.member_type === 'regular').length
  const sharedOfficeCount = users.filter((u) => u.has_shared_office).length

  async function updateUser(userId: string, field: string, value: any) {
    setUpdating((prev) => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u))
        )
      } else {
        const data = await res.json()
        alert(`更新失敗: ${data.error}`)
      }
    } catch {
      alert('通信エラー')
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }))
    }
  }

  return (
    <>
      {/* フィルター + サマリー */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-room-charcoal">表示:</span>
          {[
            { value: 'all', label: `全員 (${users.length})` },
            { value: 'member', label: `会員 (${memberCount})` },
            { value: 'non-member', label: `非会員 (${users.length - memberCount})` },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                filter === option.value
                  ? 'bg-room-main text-white'
                  : 'border border-room-base-dark bg-room-base text-room-charcoal hover:bg-room-base-dark'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-room-charcoal-light">
          シェアオフィス: {sharedOfficeCount}名
        </div>
      </div>

      {/* テーブル */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-room-base-dark">
            <thead className="bg-room-base-dark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  ユーザー名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  メールアドレス
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  会員
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  シェアオフィス
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  Stripe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-room-base-light divide-y divide-room-base-dark">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-room-base">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-room-charcoal">
                      {formatJapaneseName(u.name)}
                    </div>
                    {u.is_admin && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-room-main text-white mt-1">
                        管理者
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-room-charcoal-light">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Toggle
                      checked={u.member_type === 'regular'}
                      disabled={!!updating[u.id]}
                      onChange={(val) =>
                        updateUser(u.id, 'member_type', val ? 'regular' : 'guest')
                      }
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Toggle
                      checked={u.has_shared_office}
                      disabled={!!updating[u.id]}
                      onChange={(val) => updateUser(u.id, 'has_shared_office', val)}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {u.stripe_customer_id ? (
                      <span className="text-xs text-green-600">連携済</span>
                    ) : (
                      <span className="text-xs text-room-charcoal-light">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-room-charcoal-light">
                      {new Date(u.created_at).toLocaleDateString('ja-JP')}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-room-main hover:text-room-main-light"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="mt-4 rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center">
          <p className="text-sm text-room-wood-dark">
            {filter === 'all' ? 'ユーザーが登録されていません' : '該当するユーザーがいません'}
          </p>
        </div>
      )}
    </>
  )
}
