'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Booking {
  id: string
  booking_date: string
  start_time: string
  end_time: string
  duration_hours: number
  number_of_participants: number
  status: string
  total_amount: number
  free_hours_used: number
  notes: string | null
  google_calendar_event_id: string | null
}

interface BookingListProps {
  bookings: Booking[]
  userId: string
}

export function BookingList({ bookings, userId }: BookingListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null)
  const [pendingCancel, setPendingCancel] = useState<{ bookingId: string; googleCalendarEventId: string | null } | null>(null)

  const handleCancelClick = (bookingId: string, googleCalendarEventId: string | null) => {
    setPendingCancel({ bookingId, googleCalendarEventId })
    setShowConfirmDialog(bookingId)
  }

  const handleConfirmCancel = async () => {
    if (!pendingCancel) return
    
    const { bookingId, googleCalendarEventId } = pendingCancel
    
    // モーダルを閉じる前にキャンセル処理を開始
    setCancelling(bookingId)
    
    try {
      await handleCancel(bookingId, googleCalendarEventId)
      // 成功したらモーダルを閉じる
      setShowConfirmDialog(null)
      setPendingCancel(null)
    } catch (err) {
      // エラーが発生した場合、モーダルは開いたままにする
      console.error('Cancel failed:', err)
      // エラーはhandleCancel内でalertで表示される
    } finally {
      setCancelling(null)
    }
  }

  const handleCancelCancel = () => {
    setShowConfirmDialog(null)
    setPendingCancel(null)
  }

  const handleCancel = async (bookingId: string, googleCalendarEventId: string | null) => {
    try {
      console.log('Cancelling booking:', bookingId)
      console.log('Current user from props:', userId)
      
      // 現在のユーザーIDを取得
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Auth user ID:', user?.id)
      
      // まず予約をキャンセル状態に更新
      // RLSポリシーでアクセス権限をチェックするため、user_idの条件は不要
      // google_calendar_event_idカラムが存在しない場合があるため、select()を削除して更新のみ実行
      const { error } = await supabase
        .from('meeting_room_bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)

      if (error) {
        console.error('Cancel error:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        alert(`キャンセルに失敗しました: ${error.message}`)
        throw new Error(error.message)
      }

      console.log('Cancel success for booking:', bookingId)

      // GoogleカレンダーのイベントIDがある場合は削除
      // google_calendar_event_idカラムが存在しない場合があるため、propsから渡された値を使用
      const eventIdToDelete = googleCalendarEventId || null
      if (eventIdToDelete) {
        try {
          const deleteResponse = await fetch('/api/calendar/delete-event', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ eventId: eventIdToDelete }),
          })

          if (!deleteResponse.ok) {
            console.warn('Googleカレンダーからの予定削除に失敗しましたが、予約はキャンセルされました')
          }
        } catch (calendarErr) {
          console.error('Google Calendar event deletion error:', calendarErr)
          // Googleカレンダーからの削除が失敗しても、予約自体はキャンセルされているので続行
        }
      }

      router.refresh()
    } catch (err) {
      console.error('Cancel error:', err)
      const errorMessage = err instanceof Error ? err.message : 'キャンセル中にエラーが発生しました'
      alert(errorMessage)
      throw err // エラーを再スローして、handleConfirmCancelで処理できるようにする
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      reserved: { label: '予約済み', className: 'bg-room-main bg-opacity-20 text-room-main' },
      confirmed: { label: '確定', className: 'bg-room-wood bg-opacity-20 text-room-wood' },
      in_use: { label: '利用中', className: 'bg-room-brass bg-opacity-20 text-room-brass' },
      completed: { label: '完了', className: 'bg-room-base-dark text-room-charcoal' },
      cancelled: { label: 'キャンセル', className: 'bg-room-charcoal-light text-room-charcoal-light' },
    }
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-room-charcoal-light">予約がありません</p>
      </div>
    )
  }

  return (
    <>
      {/* 確認ダイアログ */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-room-charcoal mb-4">
              予約のキャンセル
            </h3>
            <p className="text-room-charcoal-light mb-6">
              この予約をキャンセルしますか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelCancel}
                className="px-4 py-2 text-sm rounded-md border border-room-base-dark text-room-charcoal hover:bg-room-base"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling !== null}
                className="px-4 py-2 text-sm rounded-md bg-room-charcoal text-white hover:bg-room-charcoal-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? 'キャンセル中...' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
      {bookings.map((booking) => {
        const bookingDate = new Date(booking.booking_date)
        const isPast = bookingDate < new Date() && booking.status !== 'completed' && booking.status !== 'cancelled'
        const canCancel = booking.status === 'reserved' || booking.status === 'confirmed'
        
        console.log('Booking render:', {
          id: booking.id,
          status: booking.status,
          canCancel,
          bookingDate: booking.booking_date,
          isPast
        })

        return (
          <div
            key={booking.id}
            className={`rounded-md border p-4 ${
              isPast
                ? 'border-room-base-dark bg-room-base-dark bg-opacity-50'
                : 'border-room-base-dark bg-room-base'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-room-charcoal">
                    {bookingDate.toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </span>
                  {getStatusBadge(booking.status)}
                </div>
                <div className="text-sm text-room-charcoal-light">
                  <span className="mr-4">
                    {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                  </span>
                  <span>
                    {Math.floor(booking.duration_hours)}時間{Math.round((booking.duration_hours % 1) * 60)}分
                  </span>
                </div>
                {booking.number_of_participants > 1 && (
                  <div className="text-xs text-room-charcoal-light mt-1">
                    利用人数: {booking.number_of_participants}名
                  </div>
                )}
                {booking.free_hours_used > 0 && (
                  <div className="text-xs text-room-main mt-1">
                    無料枠使用: {booking.free_hours_used}時間
                  </div>
                )}
                {booking.notes && (
                  <div className="text-xs text-room-charcoal-light mt-1">
                    備考: {booking.notes}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-room-charcoal">
                    ¥{booking.total_amount.toLocaleString()}
                  </p>
                  {booking.free_hours_used > 0 && (
                    <p className="text-xs text-room-main">
                      無料枠使用あり
                    </p>
                  )}
                </div>
                {canCancel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('Cancel button clicked for booking:', booking.id)
                      console.log('Booking status:', booking.status)
                      console.log('Can cancel:', canCancel)
                      handleCancelClick(booking.id, booking.google_calendar_event_id)
                    }}
                    disabled={cancelling === booking.id || showConfirmDialog === booking.id}
                    className="rounded-md bg-room-charcoal px-3 py-1.5 text-xs text-white hover:bg-room-charcoal-light disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {cancelling === booking.id ? 'キャンセル中...' : 'キャンセル'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
    </>
  )
}

