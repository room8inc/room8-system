'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculateCancellationFee } from '@/lib/utils/cancellation-fee'

interface CancellationButtonProps {
  userPlanId: string
  currentPlanName: string
  contractTerm: 'monthly' | 'yearly'
  paymentMethod: 'monthly' | 'annual_prepaid'
  planPrice: number
  startedAt: string
}

export function CancellationButton({
  userPlanId,
  currentPlanName,
  contractTerm,
  paymentMethod,
  planPrice,
  startedAt,
}: CancellationButtonProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [cancellationDate, setCancellationDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 今日の日付を取得
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 翌月1日を計算（デフォルト値）
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const nextMonthStr = nextMonth.toISOString().split('T')[0]

  // 初期値を設定
  if (!cancellationDate) {
    setCancellationDate(nextMonthStr)
  }

  // 解約料金を計算
  const feeResult = calculateCancellationFee({
    planPrice,
    contractTerm,
    startedAt,
    cancellationDate: cancellationDate || nextMonthStr,
  })

  const handleSubmit = async () => {
    if (!cancellationDate) {
      setError('解約日を選択してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/plans/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPlanId,
          cancellationDate,
          cancellationFee: feeResult.fee,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '退会処理に失敗しました')
      }

      // 成功したらページをリロード
      router.refresh()
      setShowModal(false)
      alert('退会申請が完了しました')
    } catch (err) {
      console.error('Cancellation error:', err)
      setError(err instanceof Error ? err.message : '退会処理に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="block w-full rounded-lg bg-room-main bg-opacity-10 border-2 border-room-main p-6 shadow transition-shadow hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-main bg-opacity-20">
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-room-main-dark">退会</h3>
              <p className="text-sm text-room-charcoal-light">プランを解約する</p>
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
          <div className="mx-4 w-full max-w-md rounded-lg bg-room-base p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-room-charcoal">退会申請</h2>

            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-2">
                  現在のプラン
                </label>
                <p className="text-sm text-room-charcoal-light">{currentPlanName}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-2">
                  解約日
                </label>
                <input
                  type="date"
                  value={cancellationDate}
                  onChange={(e) => setCancellationDate(e.target.value)}
                  min={nextMonthStr}
                  className="w-full rounded-md border border-room-base-dark bg-room-base-light px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-room-charcoal-light">
                  15日までに申請すれば翌月1日から適用されます
                </p>
              </div>

              {contractTerm === 'yearly' && feeResult.fee > 0 && (
                <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
                  <p className="text-sm font-medium text-room-main-dark mb-2">
                    解約料金
                  </p>
                  <p className="text-2xl font-bold text-room-main-dark">
                    ¥{feeResult.fee.toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-room-charcoal-light">
                    利用月数: {feeResult.monthsUsed}ヶ月
                    {feeResult.monthsUsed <= 6
                      ? '（100%返金が必要）'
                      : '（50%返金が必要）'}
                  </p>
                  <p className="text-xs text-room-charcoal-light">
                    月額割引額: ¥{feeResult.discountPerMonth.toLocaleString()}
                  </p>
                </div>
              )}

              {contractTerm === 'yearly' && feeResult.fee === 0 && (
                <div className="rounded-md bg-room-base-light border border-room-base-dark p-4">
                  <p className="text-sm text-room-charcoal-light">
                    解約料金は発生しません
                  </p>
                </div>
              )}

              {contractTerm === 'monthly' && (
                <div className="rounded-md bg-room-base-light border border-room-base-dark p-4">
                  <p className="text-sm text-room-charcoal-light">
                    月契約のため解約料金は発生しません
                  </p>
                </div>
              )}
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
                disabled={loading || !cancellationDate}
                className="flex-1 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light disabled:opacity-50"
              >
                {loading ? '処理中...' : '退会申請'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

