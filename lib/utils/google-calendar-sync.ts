import { getAllActiveCalendars } from './google-calendar'

/**
 * 単一カレンダーのイベントをDBに同期
 */
async function syncCalendar(
  calendar: any,
  calendarId: string,
  startDate: string,
  endDate: string
): Promise<{ synced: number; errors: number }> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabaseの環境変数が設定されていません')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 日時をISO形式に変換（日本時間）
  const dayStart = new Date(`${startDate}T00:00:00+09:00`)
  const dayEnd = new Date(`${endDate}T23:59:59+09:00`)

  // Googleカレンダーから予定を取得
  const response = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = response.data.items || []
  let synced = 0
  let errors = 0

  // 既存のイベントを取得（削除されたイベントを検出するため）
  const { data: existingEvents } = await supabase
    .from('google_calendar_events_cache')
    .select('event_id')
    .eq('calendar_id', calendarId)
    .gte('start_time', dayStart.toISOString())
    .lte('end_time', dayEnd.toISOString())

  const existingEventIds = new Set(existingEvents?.map(e => e.event_id) || [])
  const fetchedEventIds = new Set<string>()

  // イベントをDBに保存
  for (const event of events) {
    if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
      continue
    }

    try {
      const eventStart = new Date(event.start.dateTime)
      const eventEnd = new Date(event.end.dateTime)

      const { error: upsertError } = await supabase
        .from('google_calendar_events_cache')
        .upsert({
          event_id: event.id,
          calendar_id: calendarId,
          summary: event.summary || '',
          start_time: eventStart.toISOString(),
          end_time: eventEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'event_id,calendar_id',
        })

      if (upsertError) {
        console.error(`イベント保存エラー: ${event.id}`, upsertError)
        errors++
      } else {
        synced++
        fetchedEventIds.add(event.id)
      }
    } catch (err) {
      console.error(`イベント処理エラー: ${event.id}`, err)
      errors++
    }
  }

  // 削除されたイベントをDBから削除
  const deletedEventIds = Array.from(existingEventIds).filter(id => !fetchedEventIds.has(id))
  if (deletedEventIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('google_calendar_events_cache')
      .delete()
      .eq('calendar_id', calendarId)
      .in('event_id', deletedEventIds)

    if (deleteError) {
      console.error('削除されたイベントの削除エラー:', deleteError)
      errors++
    } else {
      console.log(`${deletedEventIds.length}件のイベントを削除しました (calendar: ${calendarId})`)
    }
  }

  return { synced, errors }
}

/**
 * 全アクティブカレンダーのイベントをDBに同期
 */
export async function syncGoogleCalendarEvents(
  startDate: string,
  endDate: string
): Promise<{ synced: number; errors: number; calendars: number }> {
  try {
    const activeCalendars = await getAllActiveCalendars()

    if (activeCalendars.length === 0) {
      console.warn('アクティブなカレンダーが設定されていません')
      return { synced: 0, errors: 0, calendars: 0 }
    }

    let totalSynced = 0
    let totalErrors = 0

    for (const { calendar, calendarId, calendarRole } of activeCalendars) {
      console.log(`同期中: ${calendarRole} (${calendarId})`)
      try {
        const result = await syncCalendar(calendar, calendarId, startDate, endDate)
        totalSynced += result.synced
        totalErrors += result.errors
        console.log(`  → ${result.synced}件同期, ${result.errors}件エラー`)
      } catch (err: any) {
        console.error(`カレンダー同期エラー (${calendarRole}): ${err.message}`)
        totalErrors++
      }
    }

    return { synced: totalSynced, errors: totalErrors, calendars: activeCalendars.length }
  } catch (error: any) {
    console.error('Googleカレンダー同期エラー:', error)
    throw error
  }
}
