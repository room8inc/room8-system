import { NextRequest, NextResponse } from 'next/server'
import { cache as reactCache } from 'react'
import { getGoogleCalendarClient } from '@/lib/utils/google-calendar'
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
 */
const getWeekEvents = reactCache(async (startDate: string, endDate: string) => {
  // Vercel KVキャッシュ（5分間）
  return getCached(
    cacheKey('calendar_events', startDate, endDate),
    async () => {
      const supabase = await createClient()
      
      // 1. DBキャッシュを確認
      const { data: cachedEvents, error: cacheError } = await supabase
        .from('google_calendar_events_cache')
        .select('event_id, summary, start_time, end_time')
        .gte('start_time', `${startDate}T00:00:00+09:00`)
        .lte('end_time', `${endDate}T23:59:59+09:00`)
      
      if (!cacheError && cachedEvents && cachedEvents.length > 0) {
        console.log(`[Cache HIT] DB cache: ${cachedEvents.length} events for ${startDate} - ${endDate}`)
        return cachedEvents.map(e => ({
          id: e.event_id,
          summary: e.summary,
          start: e.start_time,
          end: e.end_time,
        }))
      }
      
      console.log(`[Cache MISS] Fetching from Google Calendar API for ${startDate} - ${endDate}`)
      
      // 2. DBにもない場合のみGoogle APIを叩く
      const { calendar, calendarId } = await getGoogleCalendarClient()
      
      // カレンダー設定からアクティブなカレンダーIDを取得
      const { data: settings } = await supabase
        .from('google_calendar_settings')
        .select('calendar_id')
        .eq('is_active', true)
        .single()
      
      const targetCalendarId = settings?.calendar_id || calendarId
      
      const dayStart = new Date(`${startDate}T00:00:00+09:00`)
      const dayEnd = new Date(`${endDate}T23:59:59+09:00`)
      
      const response = await calendar.events.list({
        calendarId: targetCalendarId,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      })
      
      const events = response.data.items || []
      
      // 3. DBに保存（次回以降のキャッシュ用）
      if (events.length > 0) {
        const upsertData = events
          .filter((event: calendar_v3.Schema$Event) => event.id && event.start?.dateTime && event.end?.dateTime)
          .map((event: calendar_v3.Schema$Event) => ({
            event_id: event.id!,
            calendar_id: targetCalendarId,
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
            console.error('Failed to cache events in DB:', upsertError)
            // エラーでもGoogle APIの結果は返す
          } else {
            console.log(`[Cache SAVE] Saved ${upsertData.length} events to DB cache`)
          }
        }
      }
      
      return events.map((event: any) => ({
        id: event.id,
        summary: event.summary || '',
        start: event.start?.dateTime || null,
        end: event.end?.dateTime || null,
      }))
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

