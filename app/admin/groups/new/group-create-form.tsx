'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatJapaneseName } from '@/lib/utils/name'

type User = { id: string; name: string; email: string }
type Plan = {
  id: string
  name: string
  code: string
  workspace_price: number
  shared_office_price: number
}

type SlotConfig = {
  planId: string
  planType: 'workspace' | 'shared_office'
}

export default function GroupCreateForm({
  users,
  plans,
}: {
  users: User[]
  plans: Plan[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [groupType, setGroupType] = useState<'family' | 'corporate'>('family')
  const [contractTerm, setContractTerm] = useState('monthly')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [slots, setSlots] = useState<SlotConfig[]>([
    { planId: '', planType: 'workspace' },
  ])

  const addSlot = () => {
    setSlots([...slots, { planId: '', planType: 'workspace' }])
  }

  const removeSlot = (index: number) => {
    if (index === 0) return
    setSlots(slots.filter((_, i) => i !== index))
  }

  const updateSlot = (
    index: number,
    field: keyof SlotConfig,
    value: string
  ) => {
    const updated = [...slots]
    updated[index] = { ...updated[index], [field]: value }
    setSlots(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !ownerUserId || slots.some((s) => !s.planId)) {
      setError('必須項目を入力してください')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUserId,
          name,
          groupType,
          contractTerm,
          slots,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'エラーが発生しました')
      }

      const data = await res.json()
      router.push(`/admin/groups/${data.group.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6 space-y-4">
        <h2 className="text-lg font-semibold text-room-charcoal">基本情報</h2>

        <div>
          <label className="block text-sm font-medium text-room-charcoal mb-1">
            グループ名 *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 鶴田家族プラン"
            className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-room-charcoal mb-1">
              グループ種別 *
            </label>
            <select
              value={groupType}
              onChange={(e) =>
                setGroupType(e.target.value as 'family' | 'corporate')
              }
              className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
            >
              <option value="family">家族</option>
              <option value="corporate">法人</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-room-charcoal mb-1">
              契約種別
            </label>
            <select
              value={contractTerm}
              onChange={(e) => setContractTerm(e.target.value)}
              className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
            >
              <option value="monthly">月契約</option>
              <option value="yearly">年契約</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-room-charcoal mb-1">
            オーナー *
          </label>
          <select
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
            required
          >
            <option value="">選択してください</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {formatJapaneseName(u.name)} ({u.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-room-charcoal">
            スロット設定
          </h2>
          <button
            type="button"
            onClick={addSlot}
            className="rounded bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light"
          >
            スロット追加
          </button>
        </div>

        <p className="text-xs text-room-charcoal-light">
          スロット1がオーナーのプラン（定価）です。スロット2以降は50%
          OFFが適用されます。
          スロット2以降はスロット1以下のプランのみ選択可能です。
        </p>

        {slots.map((slot, index) => (
          <div
            key={index}
            className="flex gap-3 items-end rounded border border-room-base-dark p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-room-main text-white text-sm font-bold">
              {index + 1}
            </div>
            <div className="flex-1">
              <label className="block text-xs text-room-charcoal-light mb-1">
                プラン *
              </label>
              <select
                value={slot.planId}
                onChange={(e) => updateSlot(index, 'planId', e.target.value)}
                className="w-full rounded border border-room-base-dark px-2 py-1.5 text-sm"
                required
              >
                <option value="">選択してください</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} (¥
                    {(slot.planType === 'shared_office'
                      ? plan.shared_office_price
                      : plan.workspace_price
                    )?.toLocaleString()}
                    )
                    {index > 0 && (
                      <> → 50% OFF: ¥
                        {Math.floor(
                          ((slot.planType === 'shared_office'
                            ? plan.shared_office_price
                            : plan.workspace_price) || 0) / 2
                        ).toLocaleString()}
                      </>
                    )}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-room-charcoal-light mb-1">
                種別
              </label>
              <select
                value={slot.planType}
                onChange={(e) => updateSlot(index, 'planType', e.target.value)}
                className="rounded border border-room-base-dark px-2 py-1.5 text-sm"
              >
                <option value="workspace">ワークスペース</option>
                <option value="shared_office">シェアオフィス</option>
              </select>
            </div>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeSlot(index)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                削除
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/groups')}
          className="rounded-md border border-room-base-dark px-4 py-2 text-sm text-room-charcoal hover:bg-room-base-dark"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
        >
          {loading ? '作成中...' : 'グループを作成'}
        </button>
      </div>
    </form>
  )
}
