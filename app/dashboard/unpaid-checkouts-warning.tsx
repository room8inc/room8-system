'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UnpaidCheckout {
  id: string
  checkin_at: string
  checkout_at: string
  duration_minutes: number
  dropin_fee: number
  payment_status: string
}

export function UnpaidCheckoutsWarning() {
  const router = useRouter()
  const [unpaidCheckouts, setUnpaidCheckouts] = useState<UnpaidCheckout[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // クライアント側でのみ実行
    if (typeof window !== 'undefined') {
      fetchUnpaidCheckouts()
    }
  }, [])

  const fetchUnpaidCheckouts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/checkout/get-unpaid')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.unpaidCheckouts) {
        setUnpaidCheckouts(data.unpaidCheckouts || [])
        setTotalAmount(data.totalAmount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch unpaid checkouts:', error)
      setError('未決済情報の取得に失敗しました')
      // エラーが発生してもページは表示し続ける
      setUnpaidCheckouts([])
      setTotalAmount(0)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (unpaidCheckouts.length === 0) return

    setProcessing(true)
    try {
      const checkinIds = unpaidCheckouts.map(c => c.id)
      const response = await fetch('/api/checkout/retry-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ checkinIds }),
      })

      const data = await response.json()

      if (response.ok && data.successCount > 0) {
        // 成功した決済を更新
        await fetchUnpaidCheckouts()
        alert(`${data.successCount}件の決済が完了しました（合計: ${data.totalAmount.toLocaleString()}円）`)
        
        // ページをリフレッシュ
        router.refresh()
      } else {
        // エラーメッセージを表示
        const errorMessages = data.results
          ?.filter((r: any) => !r.success)
          .map((r: any) => r.error)
          .join('\n') || '決済に失敗しました'
        
        alert(`決済エラー:\n${errorMessages}`)
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('決済処理中にエラーが発生しました')
    } finally {
      setProcessing(false)
    }
  }

  // ローディング中またはエラー時は何も表示しない（エラーはコンソールに記録済み）
  if (loading || error) {
    return null
  }

  // 未決済がない場合は表示しない
  if (unpaidCheckouts.length === 0) {
    return null
  }

  return (
    <div className="mb-6 rounded-lg bg-room-main bg-opacity-10 border-2 border-room-main p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-room-main-dark mb-2">
            ⚠️ 未決済の利用があります
          </h3>
          <p className="text-sm text-room-charcoal mb-2">
            {unpaidCheckouts.length}件の未決済があります（合計: {(totalAmount || 0).toLocaleString()}円）
          </p>
          <ul className="text-xs text-room-charcoal-light space-y-1 mb-3">
            {unpaidCheckouts.slice(0, 3).map((checkout) => (
              <li key={checkout.id}>
                {new Date(checkout.checkout_at).toLocaleDateString('ja-JP')} - {checkout.duration_minutes || 0}分 - {(checkout.dropin_fee || 0).toLocaleString()}円
              </li>
            ))}
            {unpaidCheckouts.length > 3 && (
              <li>他 {unpaidCheckouts.length - 3}件...</li>
            )}
          </ul>
        </div>
        <button
          onClick={handlePayment}
          disabled={processing}
          className="ml-4 rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {processing ? '決済中...' : '支払う'}
        </button>
      </div>
    </div>
  )
}

