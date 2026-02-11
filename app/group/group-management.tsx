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

type Slot = {
  id: string
  slot_number: number
  plan_type: string
  plans: { name: string; workspace_price: number; shared_office_price: number } | null
}

type Checkin = {
  id: string
  user_id: string
  group_slot_id: string
  users: { name: string } | null
}

export default function GroupManagement({
  group,
  members,
  slots,
  checkins,
  isOwnerOrAdmin,
  currentUserId,
}: {
  group: any
  members: Member[]
  slots: Slot[]
  checkins: Checkin[]
  isOwnerOrAdmin: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkinsBySlot = new Map<string, Checkin>()
  for (const c of checkins) {
    if (c.group_slot_id) {
      checkinsBySlot.set(c.group_slot_id, c)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !inviteLastName || !inviteFirstName) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/groups/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          lastName: inviteLastName,
          firstName: inviteFirstName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      if (data.existed) {
        setMessage('既存のアカウントをグループに追加しました')
      } else {
        setMessage('招待メールを送信しました。メンバーがパスワードを設定するとチェックインできるようになります。')
      }

      setInviteLastName('')
      setInviteFirstName('')
      setInviteEmail('')
      setShowInvite(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName} をグループから削除しますか？`)) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/groups/members?memberId=${memberId}`, {
        method: 'DELETE',
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

  const [cancelLoading, setCancelLoading] = useState(false)

  const handleCancelGroup = async () => {
    if (!confirm('グループを解約しますか？Stripeのサブスクリプションもキャンセルされます。この操作は元に戻せません。')) {
      return
    }

    setCancelLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/groups/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setCancelLoading(false)
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'オーナー',
    admin: '管理者',
    member: 'メンバー',
  }

  return (
    <div className="space-y-6">
      {/* グループ名 */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-room-charcoal">{group.name}</h1>
            <p className="mt-1 text-sm text-room-charcoal-light">
              {group.group_type === 'family' ? '家族' : '法人'}グループ
            </p>
          </div>
          {isOwnerOrAdmin && (
            <button
              onClick={handleCancelGroup}
              disabled={cancelLoading}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {cancelLoading ? '処理中...' : 'グループを解約'}
            </button>
          )}
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{message}</p>
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* スロット利用状況 */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
        <h2 className="text-lg font-semibold text-room-charcoal mb-4">
          利用状況
        </h2>
        <div className="space-y-3">
          {slots.map((slot) => {
            const checkin = checkinsBySlot.get(slot.id)
            const plan = slot.plans
            const price =
              slot.plan_type === 'shared_office'
                ? plan?.shared_office_price
                : plan?.workspace_price

            return (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded border border-room-base-dark p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-room-main text-white text-sm font-bold">
                    {slot.slot_number}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-room-charcoal">
                      {plan?.name || 'プラン不明'}
                    </div>
                    <div className="text-xs text-room-charcoal-light">
                      ¥{price?.toLocaleString() || '---'}/月
                      {slot.slot_number > 1 && (
                        <span className="ml-1 text-green-600 font-medium">
                          (50% OFF)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {checkin ? (
                  <span className="inline-flex items-center rounded bg-room-main bg-opacity-10 px-2 py-0.5 text-xs text-room-main-dark">
                    利用中:{' '}
                    {checkin.users
                      ? formatJapaneseName(checkin.users.name)
                      : '不明'}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    空き
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* メンバー管理 */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-room-charcoal">
            メンバー ({members.length}人)
          </h2>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="rounded-md bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light"
            >
              メンバーを招待
            </button>
          )}
        </div>

        {/* 招待フォーム */}
        {showInvite && isOwnerOrAdmin && (
          <form
            onSubmit={handleInvite}
            className="mb-4 rounded bg-room-base p-4 border border-room-base-dark"
          >
            <p className="mb-3 text-xs text-room-charcoal-light">
              招待メールが送信されます。メンバーがパスワードを設定するとチェックインできるようになります。
            </p>
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
                  className="w-full rounded border border-room-base-dark px-2 py-1.5 text-sm"
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
                  className="w-full rounded border border-room-base-dark px-2 py-1.5 text-sm"
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
                className="w-full rounded border border-room-base-dark px-2 py-1.5 text-sm"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded border border-room-base-dark px-3 py-1.5 text-xs text-room-charcoal hover:bg-room-base-dark"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light disabled:opacity-50"
              >
                {loading ? '送信中...' : '招待メールを送信'}
              </button>
            </div>
          </form>
        )}

        {/* メンバー一覧 */}
        <div className="space-y-2">
          {members.map((member) => {
            const memberName = member.users
              ? formatJapaneseName(member.users.name)
              : '不明'
            const isCurrentUser = member.user_id === currentUserId

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded border border-room-base-dark p-3"
              >
                <div>
                  <div className="text-sm font-medium text-room-charcoal">
                    {memberName}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs text-room-charcoal-light">
                        (あなた)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-room-charcoal-light">
                    {member.users?.email || '---'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-room-charcoal-light">
                    {roleLabels[member.role] || member.role}
                  </span>
                  {isOwnerOrAdmin &&
                    member.role !== 'owner' &&
                    !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveMember(member.id, memberName)}
                        disabled={loading}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        削除
                      </button>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
