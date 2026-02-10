'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Locker = {
  id: string
  locker_number: string
  size: string | null
  status: string
  user_id: string | null
  notes: string | null
  user_name: string | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    occupied: 'bg-room-main bg-opacity-10 text-room-main-dark',
    maintenance: 'bg-yellow-100 text-yellow-800',
  }
  const labels: Record<string, string> = {
    available: '空き',
    occupied: '利用中',
    maintenance: 'メンテナンス',
  }
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function LockerManagement({ lockers }: { lockers: Locker[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleStatusChange(id: string, newStatus: string) {
    setLoading(id)
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleClearUser(id: string) {
    if (!confirm('この利用者の割り当てを解除しますか？')) return
    setLoading(id)
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, clearUser: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleAdd(size: 'large' | 'small') {
    setLoading('add')
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(id: string, lockerNumber: string) {
    if (!confirm(`${lockerNumber} を削除しますか？`)) return
    setLoading(id)
    try {
      const res = await fetch(`/api/admin/lockers?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const largeLockers = lockers.filter((l) => l.size === 'large')
  const smallLockers = lockers.filter((l) => l.size === 'small')
  const largeAvailable = largeLockers.filter((l) => l.status === 'available').length
  const smallAvailable = smallLockers.filter((l) => l.status === 'available').length

  return (
    <>
      {/* サマリーカード */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-room-base-light border border-room-base-dark p-4 shadow">
          <div className="text-sm text-room-charcoal-light">大ロッカー</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-room-charcoal">
              {largeAvailable}
            </span>
            <span className="text-sm text-room-charcoal-light">
              / {largeLockers.length} 空き
            </span>
          </div>
          {largeAvailable === 0 && (
            <div className="mt-1 text-xs text-room-main-dark font-medium">満室</div>
          )}
        </div>
        <div className="rounded-lg bg-room-base-light border border-room-base-dark p-4 shadow">
          <div className="text-sm text-room-charcoal-light">小ロッカー</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-room-charcoal">
              {smallAvailable}
            </span>
            <span className="text-sm text-room-charcoal-light">
              / {smallLockers.length} 空き
            </span>
          </div>
          {smallAvailable === 0 && (
            <div className="mt-1 text-xs text-room-main-dark font-medium">満室</div>
          )}
        </div>
      </div>

      {/* 追加ボタン */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => handleAdd('large')}
          disabled={loading === 'add'}
          className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
        >
          大ロッカー追加
        </button>
        <button
          onClick={() => handleAdd('small')}
          disabled={loading === 'add'}
          className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
        >
          小ロッカー追加
        </button>
      </div>

      {/* テーブル */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-room-base-dark">
            <thead className="bg-room-base-dark">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  番号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  サイズ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  利用者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  備考
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-room-base-light divide-y divide-room-base-dark">
              {lockers.map((locker) => (
                <tr key={locker.id} className="hover:bg-room-base">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-room-charcoal">
                    {locker.locker_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-room-charcoal-light">
                    {locker.size === 'large' ? '大' : '小'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={locker.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-room-charcoal-light">
                    {locker.user_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-room-charcoal-light">
                    {locker.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {/* ステータス変更 */}
                      <select
                        value={locker.status}
                        onChange={(e) => handleStatusChange(locker.id, e.target.value)}
                        disabled={loading === locker.id}
                        className="rounded border border-room-base-dark bg-room-base px-2 py-1 text-xs text-room-charcoal disabled:opacity-50"
                      >
                        <option value="available">空き</option>
                        <option value="occupied">利用中</option>
                        <option value="maintenance">メンテナンス</option>
                      </select>

                      {/* 利用者解除 */}
                      {locker.user_id && (
                        <button
                          onClick={() => handleClearUser(locker.id)}
                          disabled={loading === locker.id}
                          className="rounded bg-room-main bg-opacity-10 px-2 py-1 text-xs text-room-main-dark hover:bg-opacity-20 disabled:opacity-50"
                        >
                          解除
                        </button>
                      )}

                      {/* 削除（availableのみ） */}
                      {locker.status === 'available' && !locker.user_id && (
                        <button
                          onClick={() => handleDelete(locker.id, locker.locker_number)}
                          disabled={loading === locker.id}
                          className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lockers.length === 0 && (
        <div className="mt-4 rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center">
          <p className="text-sm text-room-wood-dark">ロッカーが登録されていません</p>
        </div>
      )}
    </>
  )
}
