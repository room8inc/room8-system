'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GroupDeleteButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`「${groupName}」を解約しますか？この操作は元に戻せません。`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/admin/groups')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
    >
      {loading ? '処理中...' : 'グループを解約'}
    </button>
  )
}
