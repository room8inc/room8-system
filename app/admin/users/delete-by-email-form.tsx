'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteUserByEmailForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!email) {
      setError('メールアドレスを入力してください')
      setLoading(false)
      return
    }

    if (!confirm(`メールアドレス "${email}" のユーザーを削除しますか？\n\nこの操作は取り消せません。`)) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/admin/users/delete-by-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ユーザー削除に失敗しました')
      }

      setSuccess(`ユーザー "${email}" を削除しました`)
      setEmail('')
      
      // 3秒後にページをリフレッシュ
      setTimeout(() => {
        router.refresh()
      }, 3000)
    } catch (err: any) {
      console.error('Delete user by email error:', err)
      setError(err.message || 'ユーザー削除中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
      <h2 className="text-lg font-semibold text-room-charcoal mb-4">
        メールアドレスからユーザーを削除
      </h2>
      <p className="text-sm text-room-charcoal-light mb-4">
        `public.users`から削除済みで`auth.users`に残っているユーザーを削除する場合に使用します。
        <br />
        メールアドレスを入力して削除してください。
      </p>

      <form onSubmit={handleDelete} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-room-charcoal mb-1">
            メールアドレス <span className="text-room-main-dark">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {error && (
          <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="rounded-md bg-room-error px-4 py-2 text-sm text-white hover:bg-room-error-light focus:outline-none focus:ring-2 focus:ring-room-error focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '削除中...' : 'ユーザーを削除'}
        </button>
      </form>
    </div>
  )
}

