'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatJapaneseName } from '@/lib/utils/name'

type Slot = {
  id: string
  slot_number: number
  plan_id: string
  plan_type: string
  options: any
  plans: any
}

type Checkin = {
  id: string
  user_id: string
  group_slot_id: string
  checkin_at: string
  users: { name: string } | null
}

type Plan = {
  id: string
  name: string
  code: string
  workspace_price: number
  shared_office_price: number
}

export default function GroupSlotManagement({
  groupId,
  slots,
  checkins,
  plans,
  hasSubscription,
}: {
  groupId: string
  slots: Slot[]
  checkins: Checkin[]
  plans: Plan[]
  hasSubscription: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [newSlotPlanId, setNewSlotPlanId] = useState('')
  const [newSlotPlanType, setNewSlotPlanType] = useState('workspace')

  const checkinsBySlot = new Map<string, Checkin>()
  for (const c of checkins) {
    if (c.group_slot_id) {
      checkinsBySlot.set(c.group_slot_id, c)
    }
  }

  const handleAddSlot = async () => {
    if (!newSlotPlanId) return
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/groups/${groupId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: newSlotPlanId,
          planType: newSlotPlanType,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }

      setShowAddSlot(false)
      setNewSlotPlanId('')
      router.refresh()
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('このスロットを削除しますか？')) return
    setLoading(true)

    try {
      const res = await fetch(
        `/api/admin/groups/${groupId}/slots?slotId=${slotId}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
        return
      }

      router.refresh()
    } catch {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg bg-room-base-light shadow border border-room-base-dark p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-room-charcoal">
          スロット管理
        </h2>
        <button
          onClick={() => setShowAddSlot(!showAddSlot)}
          className="rounded-md bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light"
        >
          スロット追加
        </button>
      </div>

      {/* スロット追加フォーム */}
      {showAddSlot && (
        <div className="mb-4 rounded bg-room-base p-4 border border-room-base-dark">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-room-charcoal-light mb-1">
                プラン
              </label>
              <select
                value={newSlotPlanId}
                onChange={(e) => setNewSlotPlanId(e.target.value)}
                className="w-full rounded border border-room-base-dark px-2 py-1.5 text-sm"
              >
                <option value="">選択してください</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} (WS: ¥{plan.workspace_price?.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-room-charcoal-light mb-1">
                種別
              </label>
              <select
                value={newSlotPlanType}
                onChange={(e) => setNewSlotPlanType(e.target.value)}
                className="rounded border border-room-base-dark px-2 py-1.5 text-sm"
              >
                <option value="workspace">ワークスペース</option>
                <option value="shared_office">シェアオフィス</option>
              </select>
            </div>
            <button
              onClick={handleAddSlot}
              disabled={loading || !newSlotPlanId}
              className="rounded bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>
      )}

      {/* スロット一覧 */}
      <div className="space-y-3">
        {slots.map((slot) => {
          const checkin = checkinsBySlot.get(slot.id)
          const plan = slot.plans as any
          const price =
            slot.plan_type === 'shared_office'
              ? plan?.shared_office_price
              : plan?.workspace_price

          return (
            <div
              key={slot.id}
              className="flex items-center justify-between rounded border border-room-base-dark p-3"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-room-main text-white text-sm font-bold">
                  {slot.slot_number}
                </div>
                <div>
                  <div className="text-sm font-medium text-room-charcoal">
                    {plan?.name || 'プラン不明'}
                    <span className="ml-2 text-xs text-room-charcoal-light">
                      ({slot.plan_type === 'shared_office'
                        ? 'シェアオフィス'
                        : 'ワークスペース'})
                    </span>
                  </div>
                  <div className="text-xs text-room-charcoal-light">
                    ¥{price?.toLocaleString() || '---'}/月
                    {slot.slot_number > 1 && (
                      <span className="ml-1 text-green-600 font-medium">
                        (50% OFF → ¥
                        {Math.floor((price || 0) / 2).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {checkin ? (
                  <span className="inline-flex items-center rounded bg-room-main bg-opacity-10 px-2 py-0.5 text-xs text-room-main-dark">
                    利用中: {checkin.users ? formatJapaneseName(checkin.users.name) : '不明'}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    空き
                  </span>
                )}
                {slot.slot_number > 1 && (
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={loading}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
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
  )
}
