'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SeatStatus {
  seatId: string
  seatNumber: string
  seatName: string | null
  seatType: 'free_space' | 'meeting_room'
  status: 'active' | 'maintenance' | 'disabled'
  isAvailable: boolean
  isOccupied: boolean
  occupiedBy?: {
    userId: string
    userName: string | null
    checkinAt: string
  }
  unavailableReason?: string
}

interface SeatStatusResponse {
  seats: SeatStatus[]
  mySeat: {
    seatId: string
    checkinId: string
    checkinAt: string
  } | null
  hasActiveMeetingRoomBooking: boolean
}

export function SeatMap() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [seatStatus, setSeatStatus] = useState<SeatStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null) // 処理中の座席ID

  // 座席状態を取得
  const fetchSeatStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/seats/status')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '座席状態の取得に失敗しました')
      }

      const data: SeatStatusResponse = await response.json()
      setSeatStatus(data)
    } catch (err) {
      console.error('Seat status fetch error:', err)
      setError(err instanceof Error ? err.message : '座席状態の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSeatStatus()

    // 30秒ごとに自動更新
    const interval = setInterval(fetchSeatStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  // 座席チェックイン
  const handleSeatCheckin = async (seatId: string) => {
    if (processing) return

    try {
      setProcessing(seatId)
      setError(null)

      const response = await fetch('/api/seats/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seatId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '座席チェックインに失敗しました')
      }

      // 成功したら状態を更新
      await fetchSeatStatus()
      router.refresh()
    } catch (err) {
      console.error('Seat checkin error:', err)
      setError(err instanceof Error ? err.message : '座席チェックインに失敗しました')
    } finally {
      setProcessing(null)
    }
  }

  // 座席チェックアウト
  const handleSeatCheckout = async (seatId: string) => {
    if (processing) return

    if (!confirm('この座席からチェックアウトしますか？')) {
      return
    }

    try {
      setProcessing(seatId)
      setError(null)

      const response = await fetch('/api/seats/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seatId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '座席チェックアウトに失敗しました')
      }

      // 成功したら状態を更新
      await fetchSeatStatus()
      router.refresh()
    } catch (err) {
      console.error('Seat checkout error:', err)
      setError(err instanceof Error ? err.message : '座席チェックアウトに失敗しました')
    } finally {
      setProcessing(null)
    }
  }

  // 座席をクリック
  const handleSeatClick = (seat: SeatStatus) => {
    if (processing) return

    // 自分の座席の場合はチェックアウト
    if (seatStatus?.mySeat && seatStatus.mySeat.seatId === seat.seatId) {
      handleSeatCheckout(seat.seatId)
      return
    }

    // 利用可能な座席の場合はチェックイン
    if (seat.isAvailable) {
      handleSeatCheckin(seat.seatId)
      return
    }

    // 利用不可の場合は何もしない（またはメッセージを表示）
    if (seat.unavailableReason) {
      alert(seat.unavailableReason)
    }
  }

  // 座席のスタイルを取得
  const getSeatStyle = (seat: SeatStatus) => {
    const baseStyle = 'w-16 h-16 rounded-md border-2 flex items-center justify-center text-xs font-medium cursor-pointer transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed'

    // 自分の座席
    if (seatStatus?.mySeat && seatStatus.mySeat.seatId === seat.seatId) {
      return `${baseStyle} bg-room-main text-white border-room-main-dark shadow-md`
    }

    // 利用不可
    if (!seat.isAvailable) {
      if (seat.status === 'maintenance') {
        return `${baseStyle} bg-room-charcoal-light text-white border-room-charcoal cursor-not-allowed`
      }
      if (seat.unavailableReason === '会議室予約中') {
        return `${baseStyle} bg-room-brass bg-opacity-20 text-room-charcoal border-room-brass cursor-not-allowed`
      }
      if (seat.isOccupied) {
        return `${baseStyle} bg-room-wood bg-opacity-20 text-room-charcoal border-room-wood cursor-not-allowed`
      }
      return `${baseStyle} bg-room-charcoal-light text-white border-room-charcoal cursor-not-allowed`
    }

    // 利用可能
    return `${baseStyle} bg-room-base-light text-room-charcoal border-room-base-dark hover:bg-room-main hover:text-white hover:border-room-main-dark`
  }

  if (loading && !seatStatus) {
    return (
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <h2 className="text-lg font-semibold text-room-charcoal mb-4">座席表</h2>
        <p className="text-sm text-room-charcoal-light">読み込み中...</p>
      </div>
    )
  }

  if (error && !seatStatus) {
    return (
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <h2 className="text-lg font-semibold text-room-charcoal mb-4">座席表</h2>
        <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
          <p className="text-sm text-room-main-dark">{error}</p>
          <button
            onClick={fetchSeatStatus}
            className="mt-2 text-sm text-room-main hover:text-room-main-light"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  if (!seatStatus || seatStatus.seats.length === 0) {
    return (
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <h2 className="text-lg font-semibold text-room-charcoal mb-4">座席表</h2>
        <p className="text-sm text-room-charcoal-light">座席情報がありません</p>
      </div>
    )
  }

  // 座席をタイプ別に分類
  const freeSpaceSeats = seatStatus.seats.filter((s) => s.seatType === 'free_space')
  const meetingRoomSeats = seatStatus.seats.filter((s) => s.seatType === 'meeting_room')

  return (
    <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-room-charcoal">座席表</h2>
        <button
          onClick={fetchSeatStatus}
          disabled={loading}
          className="text-sm text-room-main hover:text-room-main-light disabled:opacity-50"
        >
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
          <p className="text-sm text-room-main-dark">{error}</p>
        </div>
      )}

      {/* 凡例 */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-room-base-light border-room-base-dark"></div>
          <span className="text-room-charcoal-light">空き</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-room-main border-room-main-dark"></div>
          <span className="text-room-charcoal-light">自分の座席</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-room-wood bg-opacity-20 border-room-wood"></div>
          <span className="text-room-charcoal-light">使用中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-room-brass bg-opacity-20 border-room-brass"></div>
          <span className="text-room-charcoal-light">会議室予約中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-room-charcoal-light border-room-charcoal"></div>
          <span className="text-room-charcoal-light">メンテナンス</span>
        </div>
      </div>

      {/* フリースペース座席 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-room-charcoal mb-3">フリースペース</h3>
        <div className="grid grid-cols-7 gap-2">
          {freeSpaceSeats.map((seat) => (
            <button
              key={seat.seatId}
              onClick={() => handleSeatClick(seat)}
              disabled={processing === seat.seatId || (!seat.isAvailable && seatStatus.mySeat?.seatId !== seat.seatId)}
              className={getSeatStyle(seat)}
              title={seat.unavailableReason || (seat.isOccupied && seat.occupiedBy ? `使用中: ${seat.occupiedBy.userName || '不明'}` : '空き')}
            >
              {seat.seatNumber}
            </button>
          ))}
        </div>
      </div>

      {/* 会議室座席 */}
      {meetingRoomSeats.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-room-charcoal mb-3">
            会議室座席
            {seatStatus.hasActiveMeetingRoomBooking && (
              <span className="ml-2 text-xs text-room-brass">（会議室予約中）</span>
            )}
          </h3>
          <div className="grid grid-cols-8 gap-2">
            {meetingRoomSeats.map((seat) => (
              <button
                key={seat.seatId}
                onClick={() => handleSeatClick(seat)}
                disabled={processing === seat.seatId || (!seat.isAvailable && seatStatus.mySeat?.seatId !== seat.seatId)}
                className={getSeatStyle(seat)}
                title={seat.unavailableReason || (seat.isOccupied && seat.occupiedBy ? `使用中: ${seat.occupiedBy.userName || '不明'}` : '空き')}
              >
                {seat.seatNumber.replace('MR-', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 自分の座席情報 */}
      {seatStatus.mySeat && (
        <div className="mt-4 rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
          <p className="text-sm font-medium text-room-main-dark">
            現在の座席: {seatStatus.seats.find((s) => s.seatId === seatStatus.mySeat!.seatId)?.seatNumber || '不明'}
          </p>
          <p className="text-xs text-room-charcoal-light mt-1">
            座席をタップしてチェックアウトできます
          </p>
        </div>
      )}
    </div>
  )
}

