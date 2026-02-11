'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Plan = {
  id: string
  name: string
  code: string
  workspace_price: number
  shared_office_price: number
  weekday_start_time: string | null
  weekday_end_time: string | null
  weekend_start_time: string | null
  weekend_end_time: string | null
}

type SlotConfig = {
  planId: string
  planType: 'workspace' | 'shared_office'
}

export default function GroupPlanForm({ plans }: { plans: Plan[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState<'family' | 'corporate'>('family')
  const [slots, setSlots] = useState<SlotConfig[]>([
    { planId: '', planType: 'workspace' },
    { planId: '', planType: 'workspace' },
  ])

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  const formatAvailableTime = (plan: Plan) => {
    const hasWeekday = plan.weekday_start_time && plan.weekday_end_time
    const hasWeekend = plan.weekend_start_time && plan.weekend_end_time

    if (hasWeekday && hasWeekend) {
      return `平日 ${formatTime(plan.weekday_start_time)}〜${formatTime(plan.weekday_end_time)} / 土日祝 ${formatTime(plan.weekend_start_time)}〜${formatTime(plan.weekend_end_time)}`
    } else if (hasWeekday) {
      return `平日 ${formatTime(plan.weekday_start_time)}〜${formatTime(plan.weekday_end_time)}`
    } else if (hasWeekend) {
      return `土日祝 ${formatTime(plan.weekend_start_time)}〜${formatTime(plan.weekend_end_time)}`
    }
    return ''
  }

  const addSlot = () => {
    setSlots([...slots, { planId: '', planType: 'workspace' }])
  }

  const removeSlot = (index: number) => {
    if (slots.length <= 2) return
    setSlots(slots.filter((_, i) => i !== index))
  }

  const updateSlot = (index: number, field: keyof SlotConfig, value: string) => {
    const updated = [...slots]
    updated[index] = { ...updated[index], [field]: value }
    setSlots(updated)
  }

  const getSlotPrice = (slot: SlotConfig) => {
    const plan = plans.find((p) => p.id === slot.planId)
    if (!plan) return 0
    return slot.planType === 'shared_office'
      ? plan.shared_office_price
      : plan.workspace_price
  }

  const totalMonthly = slots.reduce((sum, slot, index) => {
    const price = getSlotPrice(slot)
    return sum + (index === 0 ? price : Math.floor(price / 2))
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!groupName) {
      setError('グループ名を入力してください')
      return
    }

    if (slots.some((s) => !s.planId)) {
      setError('すべてのスロットのプランを選択してください')
      return
    }

    // slot 1のプラン価格を超えるスロットがないかチェック
    const firstSlotPrice = getSlotPrice(slots[0])
    for (let i = 1; i < slots.length; i++) {
      if (getSlotPrice(slots[i]) > firstSlotPrice) {
        setError(`スロット${i + 1}のプランがスロット1のプランを超えています。スロット1以下のプランを選択してください。`)
        return
      }
    }

    setLoading(true)

    try {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          groupType,
          slots,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      router.push('/group')
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

      {/* 基本情報 */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6 space-y-4">
        <h2 className="text-lg font-semibold text-room-charcoal">基本情報</h2>

        <div>
          <label className="block text-sm font-medium text-room-charcoal mb-1">
            グループ名 *
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="例: 鶴田ファミリー"
            className="w-full rounded border border-room-base-dark px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-room-charcoal mb-1">
            種別
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGroupType('family')}
              className={`flex-1 rounded-lg border-2 p-3 text-sm text-center transition-all ${
                groupType === 'family'
                  ? 'border-room-main bg-room-main bg-opacity-5 font-medium'
                  : 'border-room-base-dark hover:border-room-main'
              }`}
            >
              家族
            </button>
            <button
              type="button"
              onClick={() => setGroupType('corporate')}
              className={`flex-1 rounded-lg border-2 p-3 text-sm text-center transition-all ${
                groupType === 'corporate'
                  ? 'border-room-main bg-room-main bg-opacity-5 font-medium'
                  : 'border-room-base-dark hover:border-room-main'
              }`}
            >
              法人
            </button>
          </div>
        </div>
      </div>

      {/* スロット設定 */}
      <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-room-charcoal">
            利用枠の設定
          </h2>
          <button
            type="button"
            onClick={addSlot}
            className="rounded bg-room-main px-3 py-1.5 text-xs text-white hover:bg-room-main-light"
          >
            枠を追加
          </button>
        </div>

        <p className="text-xs text-room-charcoal-light">
          同時に利用できる人数分の枠を設定してください。枠1があなたのプランになります。枠2以降は50% OFFです。
        </p>

        {slots.map((slot, index) => {
          const price = getSlotPrice(slot)
          const discountedPrice = index > 0 ? Math.floor(price / 2) : price

          return (
            <div
              key={index}
              className="rounded border border-room-base-dark p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-room-main text-white text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium text-room-charcoal">
                    {index === 0 ? 'あなたの枠' : `枠${index + 1}`}
                    {index > 0 && (
                      <span className="ml-1 text-green-600 text-xs font-medium">
                        50% OFF
                      </span>
                    )}
                  </span>
                </div>
                {index >= 2 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-room-charcoal-light mb-1">
                  プラン
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
                      {plan.name} — {formatAvailableTime(plan)}
                    </option>
                  ))}
                </select>
              </div>

              {slot.planId && (
                <div className="text-right text-sm text-room-charcoal">
                  {index > 0 && price > 0 && (
                    <span className="line-through text-room-charcoal-light mr-2">
                      ¥{price.toLocaleString()}
                    </span>
                  )}
                  <span className="font-bold text-room-main">
                    ¥{discountedPrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-room-charcoal-light">/月</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 合計金額 */}
      {totalMonthly > 0 && (
        <div className="rounded-lg bg-room-main bg-opacity-5 border border-room-main p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-room-charcoal">
              月額合計（税込）
            </span>
            <span className="text-2xl font-bold text-room-main">
              ¥{totalMonthly.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-room-charcoal-light text-right">
            {slots.length}枠 ・ 同時利用上限{slots.length}人
          </p>
        </div>
      )}

      {/* 送信 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/plans')}
          className="rounded-md border border-room-base-dark px-4 py-2 text-sm text-room-charcoal hover:bg-room-base-dark"
        >
          戻る
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-room-main px-6 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
        >
          {loading ? '申し込み中...' : 'グループプランを申し込む'}
        </button>
      </div>
    </form>
  )
}
