'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatJapaneseName } from '@/lib/utils/name'

type AvailablePlan = {
  id: string
  code: string
  name: string
  workspace_price: number
  shared_office_price: number
}

type Member = {
  id: string
  userName: string
  email: string
  planName: string
  planType: string
  monthlyPrice: number
  discountedPrice: number
  discountCode: string
  startedAt: string
}

export function MemberManagement({
  hostPlanName,
  availablePlans,
}: {
  hostPlanName: string
  availablePlans: AvailablePlan[]
}) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [totalMonthly, setTotalMonthly] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  // 招待フォーム
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [invitePlanId, setInvitePlanId] = useState('')

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/members/list')
      const data = await res.json()
      if (res.ok) {
        setMembers(data.members || [])
        setTotalMonthly(data.totalMonthly || 0)
      } else {
        setError(data.error)
      }
    } catch {
      setError('メンバー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !inviteLastName || !inviteFirstName || !invitePlanId) return

    setActionLoading(true)
    setError(null)
    setMessage(null)
    setCredentials(null)

    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: inviteLastName,
          firstName: inviteFirstName,
          email: inviteEmail,
          password: invitePassword || undefined,
          planId: invitePlanId,
          planType: 'workspace',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      if (data.existed) {
        setMessage('既存のアカウントをメンバーに追加しました')
      } else {
        setMessage('メンバーのアカウントを作成しました。以下のログイン情報をメンバーに伝えてください。')
        if (data.credentials) {
          setCredentials(data.credentials)
        }
      }

      setInviteLastName('')
      setInviteFirstName('')
      setInviteEmail('')
      setInvitePassword('')
      setInvitePlanId('')
      setShowInvite(false)
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemove = async (memberPlanId: string, memberName: string) => {
    if (!confirm(`${memberName} をメンバーから削除しますか？`)) return

    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/members/remove?memberPlanId=${memberPlanId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'エラーが発生しました')
      }

      setMessage('メンバーを削除しました')
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-room-charcoal">メンバー管理</h1>
            <p className="mt-1 text-sm text-room-charcoal-light">
              あなたのプラン: {hostPlanName}
            </p>
          </div>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
          >
            メンバーを追加
          </button>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{message}</p>
        </div>
      )}
      {credentials && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">ログイン情報</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-700 w-20">メール:</span>
              <code className="text-sm bg-white px-2 py-0.5 rounded border">{credentials.email}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-700 w-20">パスワード:</span>
              <code className="text-sm bg-white px-2 py-0.5 rounded border">{credentials.password}</code>
            </div>
          </div>
          <p className="mt-2 text-xs text-blue-600">
            この情報をメンバーに伝えてください。この画面を閉じると再表示できません。
          </p>
          <button
            onClick={() => setCredentials(null)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
          >
            閉じる
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 招待フォーム */}
      {showInvite && (
        <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            メンバーを追加
          </h2>
          <p className="mb-4 text-xs text-room-charcoal-light">
            メンバーのアカウントを作成します。ログイン情報はメンバーに直接お伝えください。
            メンバーは50% OFFで利用できます。
          </p>
          <form onSubmit={handleInvite}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-room-charcoal-light mb-1">
                  姓 *
                </label>
                <input
                  type="text"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="鶴田"
                  className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-room-charcoal-light mb-1">
                  名 *
                </label>
                <input
                  type="text"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="花子"
                  className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-room-charcoal-light mb-1">
                メールアドレス *
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="hanako@example.com"
                className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-room-charcoal-light mb-1">
                パスワード（空欄の場合は自動生成）
              </label>
              <input
                type="text"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="自動生成されます"
                className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-room-charcoal-light mb-1">
                プラン *
              </label>
              <select
                value={invitePlanId}
                onChange={(e) => setInvitePlanId(e.target.value)}
                className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
                required
              >
                <option value="">プランを選択してください</option>
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - &yen;{Math.floor(plan.workspace_price / 2).toLocaleString()}/月（50% OFF）
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded border border-room-base-dark px-4 py-2 text-sm text-room-charcoal hover:bg-room-base-dark"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
              >
                {actionLoading ? '追加中...' : '追加する'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* メンバー一覧 */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
        <h2 className="text-lg font-semibold text-room-charcoal mb-4">
          メンバー一覧 ({members.length}人)
        </h2>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 rounded bg-room-base-dark" />
            <div className="h-16 rounded bg-room-base-dark" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-room-charcoal-light text-center py-4">
            まだメンバーはいません。上の「メンバーを招待」ボタンから招待してください。
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded border border-room-base-dark p-4"
              >
                <div>
                  <div className="text-sm font-medium text-room-charcoal">
                    {formatJapaneseName(member.userName)}
                  </div>
                  <div className="text-xs text-room-charcoal-light">
                    {member.email}
                  </div>
                  <div className="mt-1 text-xs text-room-charcoal-light">
                    {member.planName}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-room-charcoal">
                      &yen;{member.discountedPrice.toLocaleString()}/月
                    </div>
                    {member.discountCode === 'group_50off' && (
                      <span className="text-xs text-green-600 font-medium">
                        50% OFF
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(member.id, formatJapaneseName(member.userName))}
                    disabled={actionLoading}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 合計金額 */}
        {members.length > 0 && (
          <div className="mt-4 pt-4 border-t border-room-base-dark flex justify-between items-center">
            <span className="text-sm font-medium text-room-charcoal">
              メンバー合計（月額）
            </span>
            <span className="text-lg font-bold text-room-main">
              &yen;{totalMonthly.toLocaleString()}/月
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
