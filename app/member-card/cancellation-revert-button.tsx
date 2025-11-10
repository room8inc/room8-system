'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CancellationRevertButtonProps {
  userPlanId: string
}

export function CancellationRevertButton({ userPlanId }: CancellationRevertButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRevert = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/plans/cancel/revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userPlanId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '解約申請の取り消しに失敗しました')
      }

      alert('解約申請を取り消しました')
      router.refresh()
    } catch (err) {
      console.error('Cancellation revert error:', err)
      setError(err instanceof Error ? err.message : '解約申請の取り消しに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-3 text-sm text-room-main-dark">
          {error}
        </div>
      )}
      <button
        onClick={handleRevert}
        disabled={loading}
        className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
      >
        {loading ? '処理中...' : '解約申請を取り消す'}
      </button>
    </div>
  )
}
