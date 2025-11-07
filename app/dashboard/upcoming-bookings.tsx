import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export async function UpcomingBookings({ userId, staffMemberId, isStaff }: { userId: string; staffMemberId: string | null; isStaff: boolean }) {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // 会議室予約一覧を取得（今後の予約のみ、最新5件）
  let upcomingBookingsQuery = supabase
    .from('meeting_room_bookings')
    .select('id, booking_date, start_time, end_time, duration_hours, total_amount, status')
    .in('status', ['reserved', 'confirmed'])
    .gte('booking_date', todayStr)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5)

  if (isStaff && staffMemberId) {
    upcomingBookingsQuery = upcomingBookingsQuery.or(`user_id.eq.${userId},staff_member_id.eq.${staffMemberId}`)
  } else {
    upcomingBookingsQuery = upcomingBookingsQuery.eq('user_id', userId)
  }

  const { data: upcomingBookings } = await upcomingBookingsQuery

  if (!upcomingBookings || upcomingBookings.length === 0) {
    return null
  }

  return (
    <div className="mt-8">
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-room-charcoal">今後の会議室予約</h2>
          <Link
            href="/meeting-rooms"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            全て見る →
          </Link>
        </div>
        <div className="space-y-3">
          {upcomingBookings.map((booking) => {
            const bookingDate = new Date(booking.booking_date)
            const statusMap: Record<string, { label: string; className: string }> = {
              reserved: { label: '予約済み', className: 'bg-room-main bg-opacity-20 text-room-main' },
              confirmed: { label: '確定', className: 'bg-room-wood bg-opacity-20 text-room-wood' },
            }
            const statusInfo = statusMap[booking.status] || { label: booking.status, className: 'bg-gray-100 text-gray-800' }
            
            return (
              <div
                key={booking.id}
                className="rounded-md border border-room-base-dark bg-room-base p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-room-charcoal">
                        {bookingDate.toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="text-sm text-room-charcoal-light">
                      <span className="mr-4">
                        {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                      </span>
                      <span>
                        {Math.floor(booking.duration_hours)}時間{Math.round((booking.duration_hours % 1) * 60)}分
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-room-charcoal">
                      ¥{booking.total_amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

