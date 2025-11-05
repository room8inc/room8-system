import { getGoogleCalendarClient } from './google-calendar'

/**
 * GoogleカレンダーのイベントをDBに同期
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param endDate 終了日（YYYY-MM-DD形式）
 */
export async function syncGoogleCalendarEvents(
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

  try {
    // Googleカレンダークライアントを取得
    const { calendar, calendarId } = await getGoogleCalendarClient()

    // カレンダー設定からアクティブなカレンダーIDを取得
    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('calendar_id')
      .eq('is_active', true)
      .single()

    const targetCalendarId = settings?.calendar_id || calendarId

    if (!targetCalendarId) {
      throw new Error('GoogleカレンダーIDが設定されていません')
    }

    // 日時をISO形式に変換（日本時間）
    const dayStart = new Date(`${startDate}T00:00:00+09:00`)
    const dayEnd = new Date(`${endDate}T23:59:59+09:00`)

    // Googleカレンダーから予定を取得
    const response = await calendar.events.list({
      calendarId: targetCalendarId,
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
      .eq('calendar_id', targetCalendarId)
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
            calendar_id: targetCalendarId,
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
        .eq('calendar_id', targetCalendarId)
        .in('event_id', deletedEventIds)

      if (deleteError) {
        console.error('削除されたイベントの削除エラー:', deleteError)
        errors++
      } else {
        console.log(`${deletedEventIds.length}件のイベントを削除しました`)
      }
    }

    return { synced, errors }
  } catch (error: any) {
    console.error('Googleカレンダー同期エラー:', error)
    throw error
  }
}

