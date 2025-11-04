'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteUserButtonProps {
  userId: string
  userName: string
}

export function DeleteUserButton({ userId, userName }: DeleteUserButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ユーザー削除に失敗しました')
      }

      // 削除成功後、ユーザー一覧ページにリダイレクト
      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      console.error('Delete user error:', err)
      setError(err.message || 'ユーザー削除中にエラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-md bg-room-error px-4 py-2 text-sm text-white hover:bg-room-error-light focus:outline-none focus:ring-2 focus:ring-room-error focus:ring-offset-2"
        >
          ユーザーを削除
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md bg-room-error bg-opacity-10 border border-room-error p-4">
            <p className="text-sm text-room-error-dark font-medium mb-2">
              本当に削除しますか？
            </p>
            <p className="text-sm text-room-error-dark">
              <strong>{userName}</strong> さんを削除します。
              <br />
              この操作は取り消せません。
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="rounded-md bg-room-error px-4 py-2 text-sm text-white hover:bg-room-error-light focus:outline-none focus:ring-2 focus:ring-room-error focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '削除中...' : '削除する'}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false)
                setError(null)
              }}
              disabled={loading}
              className="rounded-md bg-room-base-dark px-4 py-2 text-sm text-room-charcoal hover:bg-room-base-dark-light focus:outline-none focus:ring-2 focus:ring-room-base-dark focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

