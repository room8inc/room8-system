import { NextRequest, NextResponse } from 'next/server'
import { cache as reactCache } from 'react'
import { getAllActiveCalendars } from '@/lib/utils/google-calendar'
import { getCached, cacheKey } from '@/lib/cache/vercel-kv'
import { createClient } from '@/lib/supabase/server'
import { calendar_v3 } from 'googleapis'

export const runtime = 'nodejs'

/**
 * Googleカレンダーから週全体のイベントを取得
 * 3層キャッシュ戦略:
 * 1. React cache (リクエスト単位でメモ化)
 * 2. Vercel KV (5分間)
 * 3. Supabase DB (google_calendar_events_cache)
 *
 * calendar_role付きで返すため、クライアント側でmeeting_room/personalを分離可能
 */
const getWeekEvents = reactCache(async (startDate: string, endDate: string) => {
  // Vercel KVキャッシュ（5分間）
  return getCached(
    cacheKey('calendar_events', startDate, endDate),
    async () => {
      const supabase = await createClient()

      // 全アクティブカレンダーのIDを取得
      const { data: activeSettings } = await supabase
        .from('google_calendar_settings')
        .select('calendar_id, calendar_role')
        .eq('is_active', true)

      const calendarIdToRole = new Map<string, string>()
      for (const s of activeSettings || []) {
        calendarIdToRole.set(s.calendar_id, s.calendar_role)
      }

      // 1. DBキャッシュを確認（全カレンダー分）
      const { data: cachedEvents, error: cacheError } = await supabase
        .from('google_calendar_events_cache')
        .select('event_id, calendar_id, summary, start_time, end_time')
        .gte('start_time', `${startDate}T00:00:00+09:00`)
        .lte('end_time', `${endDate}T23:59:59+09:00`)

      if (!cacheError && cachedEvents && cachedEvents.length > 0) {
        console.log(`[Cache HIT] DB cache: ${cachedEvents.length} events for ${startDate} - ${endDate}`)
        return cachedEvents.map(e => ({
          id: e.event_id,
          summary: e.summary,
          start: e.start_time,
          end: e.end_time,
          calendarRole: calendarIdToRole.get(e.calendar_id) || 'meeting_room',
        }))
      }

      console.log(`[Cache MISS] Fetching from Google Calendar API for ${startDate} - ${endDate}`)

      // 2. DBにもない場合のみGoogle APIを叩く（全アクティブカレンダー）
      const activeCalendars = await getAllActiveCalendars()
      const allEvents: Array<{ id: string; summary: string; start: string | null; end: string | null; calendarRole: string }> = []

      for (const { calendar, calendarId, calendarRole } of activeCalendars) {
        const dayStart = new Date(`${startDate}T00:00:00+09:00`)
        const dayEnd = new Date(`${endDate}T23:59:59+09:00`)

        const response = await calendar.events.list({
          calendarId,
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        })

        const events = response.data.items || []

        // 3. DBに保存
        const upsertData = events
          .filter((event: calendar_v3.Schema$Event) => event.id && event.start?.dateTime && event.end?.dateTime)
          .map((event: calendar_v3.Schema$Event) => ({
            event_id: event.id!,
            calendar_id: calendarId,
            summary: event.summary || '',
            start_time: event.start!.dateTime!,
            end_time: event.end!.dateTime!,
            updated_at: new Date().toISOString(),
          }))

        if (upsertData.length > 0) {
          const { error: upsertError } = await supabase
            .from('google_calendar_events_cache')
            .upsert(upsertData, { onConflict: 'event_id,calendar_id' })

          if (upsertError) {
            console.error(`Failed to cache events for ${calendarRole}:`, upsertError)
          } else {
            console.log(`[Cache SAVE] Saved ${upsertData.length} events for ${calendarRole}`)
          }
        }

        for (const event of events) {
          allEvents.push({
            id: event.id || '',
            summary: event.summary || '',
            start: event.start?.dateTime || null,
            end: event.end?.dateTime || null,
            calendarRole,
          })
        }
      }

      return allEvents
    },
    300 // 5分キャッシュ
  )
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body // YYYY-MM-DD形式

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '日付範囲が指定されていません' },
        { status: 400 }
      )
    }

    const events = await getWeekEvents(startDate, endDate)
    return NextResponse.json({ events })
  } catch (error: any) {
    console.error('Google Calendar events fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Googleカレンダーの取得に失敗しました' },
      { status: 500 }
    )
  }
}
