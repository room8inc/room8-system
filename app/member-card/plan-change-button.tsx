'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PlanChangeButtonProps {
  userPlanId: string
  currentPlanName: string
  contractTerm: 'monthly' | 'yearly'
  paymentMethod: 'monthly' | 'annual_prepaid'
  planPrice: number
}

interface Plan {
  id: string
  name: string
  price: number
}

export function PlanChangeButton({
  userPlanId,
  currentPlanName,
  contractTerm,
  paymentMethod,
  planPrice,
}: PlanChangeButtonProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [changeDate, setChangeDate] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 今日の日付を取得
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 翌月1日を計算（デフォルト値）
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const nextMonthStr = nextMonth.toISOString().split('T')[0]

  // 初期値を設定
  useEffect(() => {
    if (!changeDate) {
      setChangeDate(nextMonthStr)
    }
  }, [nextMonthStr])

  // プラン一覧を取得
  useEffect(() => {
    if (showModal) {
      const fetchPlans = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from('plans')
          .select('id, name, price')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (data) {
          setPlans(data)
        }
      }

      fetchPlans()
    }
  }, [showModal])

  const handleSubmit = async () => {
    if (!changeDate) {
      setError('変更日を選択してください')
      return
    }

    if (!selectedPlanId) {
      setError('変更先プランを選択してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/plans/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPlanId,
          newPlanId: selectedPlanId,
          changeDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'プラン変更処理に失敗しました')
      }

      // 成功したらページをリロード
      router.refresh()
      setShowModal(false)
      alert('プラン変更申請が完了しました')
    } catch (err) {
      console.error('Plan change error:', err)
      setError(err instanceof Error ? err.message : 'プラン変更処理に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="block w-full rounded-lg bg-room-base-light p-6 shadow transition-shadow hover:shadow-md border border-room-base-dark"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-main bg-opacity-10">
              <svg
                className="h-6 w-6 text-room-main"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-room-charcoal">プラン変更</h3>
              <p className="text-sm text-room-charcoal-light">プランを変更する</p>
            </div>
          </div>
          <svg
            className="h-5 w-5 text-room-wood"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-room-base p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-xl font-bold text-room-charcoal">プラン変更申請</h2>

            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-2">
                  現在のプラン
                </label>
                <p className="text-sm text-room-charcoal-light">{currentPlanName}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-2">
                  変更先プラン
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-md border border-room-base-dark bg-room-base-light px-3 py-2 text-sm"
                >
                  <option value="">選択してください</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} (¥{plan.price.toLocaleString()}/月)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-2">
                  変更日
                </label>
                <input
                  type="date"
                  value={changeDate}
                  onChange={(e) => setChangeDate(e.target.value)}
                  min={nextMonthStr}
                  className="w-full rounded-md border border-room-base-dark bg-room-base-light px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-room-charcoal-light">
                  15日までに申請すれば翌月1日から適用されます
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
                <p className="text-sm text-room-main-dark">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1 rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !changeDate || !selectedPlanId}
                className="flex-1 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
              >
                {loading ? '処理中...' : 'プラン変更申請'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

