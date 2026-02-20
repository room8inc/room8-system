'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MembershipStatusProps {
  userId: string
  currentMemberType: string
  stripeCustomerId: string | null
  membershipNote: string | null
  hasActiveSubscription: boolean
}

export function MembershipStatus({
  userId,
  currentMemberType,
  stripeCustomerId,
  membershipNote,
  hasActiveSubscription,
}: MembershipStatusProps) {
  const router = useRouter()
  const [memberType, setMemberType] = useState(currentMemberType)
  const [note, setNote] = useState(membershipNote || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isMember = memberType === 'regular'

  const handleToggle = () => {
    setMemberType(isMember ? 'guest' : 'regular')
    setSuccess(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_type: memberType,
          membership_note: note,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '更新に失敗しました')
      }

      setSuccess(true)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = memberType !== currentMemberType || note !== (membershipNote || '')

  return (
    <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
      <h2 className="text-lg font-semibold text-room-charcoal mb-4">
        会員ステータス
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
          <p className="text-sm text-room-main-dark">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3">
          <p className="text-sm text-green-800">更新しました</p>
        </div>
      )}

      <div className="space-y-4">
        {/* 会員トグル */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-room-charcoal">会員フラグ</p>
            <p className="text-xs text-room-charcoal-light mt-1">
              {isMember ? 'Room8会員（regular）' : '非会員（guest）'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isMember ? 'bg-room-main' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isMember ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Stripe連携情報 */}
        <div>
          <p className="text-sm font-medium text-room-charcoal">Stripe連携</p>
          {stripeCustomerId ? (
            <div className="mt-1 space-y-1">
              <p className="text-xs text-room-charcoal-light">
                Customer ID: <code className="bg-room-base-dark px-1 rounded">{stripeCustomerId}</code>
              </p>
              <p className="text-xs">
                {hasActiveSubscription ? (
                  <span className="text-green-700">サブスクリプション有効</span>
                ) : (
                  <span className="text-room-charcoal-light">アクティブなサブスクリプションなし</span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-xs text-room-charcoal-light mt-1">
              Stripe連携なし（銀行振込等の可能性）
            </p>
          )}
        </div>

        {/* 備考欄 */}
        <div>
          <label htmlFor="membershipNote" className="block text-sm font-medium text-room-charcoal">
            備考
          </label>
          <textarea
            id="membershipNote"
            rows={2}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setSuccess(false)
            }}
            placeholder="例: 銀行振込 毎月15日、旧プラン据え置き"
            className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {/* 保存ボタン */}
        {hasChanges && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '変更を保存'}
          </button>
        )}
      </div>
    </div>
  )
}
