'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateSubscriptionClientButton({
  groupId,
}: {
  groupId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!confirm('Stripeサブスクリプションを作成しますか？定期決済が開始されます。')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/groups/${groupId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'エラーが発生しました')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
      >
        {loading ? '作成中...' : 'サブスクリプションを作成'}
      </button>
    </>
  )
}
