import { createClient } from '@/lib/supabase/server'

export async function CheckinHistory({ userId }: { userId: string }) {
  const supabase = await createClient()

  // 利用履歴を取得（最新30件）
  const { data: checkinHistory } = await supabase
    .from('checkins')
    .select('id, checkin_at, checkout_at, duration_minutes')
    .eq('user_id', userId)
    .order('checkin_at', { ascending: false })
    .limit(30)

  return (
    <div className="mt-8">
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <h2 className="mb-4 text-lg font-semibold text-room-charcoal">利用履歴</h2>
        {checkinHistory && checkinHistory.length > 0 ? (
          <div className="space-y-3">
            {checkinHistory.map((checkin) => {
              const checkinAt = new Date(checkin.checkin_at)
              const checkoutAt = checkin.checkout_at ? new Date(checkin.checkout_at) : null
              const duration = checkin.duration_minutes || null
              
              return (
                <div
                  key={checkin.id}
                  className="rounded-md border border-room-base-dark bg-room-base p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-room-charcoal">
                          {checkinAt.toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        {!checkoutAt && (
                          <span className="rounded-full bg-room-main bg-opacity-20 px-2 py-0.5 text-xs font-medium text-room-main">
                            チェックイン中
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-room-charcoal-light">
                        <span className="mr-4">
                          入室: {checkinAt.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {checkoutAt && (
                          <span>
                            退室: {checkoutAt.toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-right sm:mt-0">
                      {duration !== null ? (
                        <div className="text-sm text-room-charcoal">
                          <span className="font-medium">
                            {Math.floor(duration / 60)}時間{duration % 60}分
                          </span>
                        </div>
                      ) : checkoutAt ? (
                        <div className="text-xs text-room-charcoal-light">時間未計算</div>
                      ) : (
                        <div className="text-xs text-room-charcoal-light">利用中</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-room-charcoal-light">利用履歴がありません</p>
        )}
      </div>
    </div>
  )
}

