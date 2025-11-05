import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { getGoogleCalendarClient } from '@/lib/utils/google-calendar'
import { google } from 'googleapis'

export const runtime = 'nodejs'

/**
 * GoogleカレンダーWatchチャンネルを登録
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

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
      return NextResponse.json(
        { error: 'GoogleカレンダーIDが設定されていません' },
        { status: 400 }
      )
    }

    // 既存のチャンネルを停止
    const { data: existingChannels } = await supabase
      .from('google_calendar_watch_channels')
      .select('channel_id, resource_id')
      .eq('calendar_id', targetCalendarId)

    for (const channel of existingChannels || []) {
      try {
        await calendar.channels.stop({
          requestBody: {
            id: channel.channel_id,
            resourceId: channel.resource_id,
          },
        })
      } catch (err) {
        console.error('既存チャンネルの停止エラー:', err)
      }
    }

    // 既存チャンネルをDBから削除
    await supabase
      .from('google_calendar_watch_channels')
      .delete()
      .eq('calendar_id', targetCalendarId)

    // Webhook URLを構築
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const webhookUrl = `${baseUrl}/api/calendar/webhook`

    // チャンネルIDとトークンを生成（ランダム文字列）
    const channelId = `channel-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const token = Math.random().toString(36).substring(7)

    // Watchチャンネルを登録
    const watchResponse = await calendar.events.watch({
      calendarId: targetCalendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: token,
      },
    })

    const resourceId = watchResponse.data.resourceId
    const expiration = watchResponse.data.expiration
      ? new Date(parseInt(watchResponse.data.expiration))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // デフォルト7日後

    // DBに保存
    const { error: saveError } = await supabase
      .from('google_calendar_watch_channels')
      .insert({
        calendar_id: targetCalendarId,
        channel_id: channelId,
        resource_id: resourceId || '',
        expiration: expiration.toISOString(),
      })

    if (saveError) {
      console.error('チャンネル保存エラー:', saveError)
      return NextResponse.json(
        { error: 'チャンネルの保存に失敗しました', details: saveError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      channelId,
      resourceId,
      expiration: expiration.toISOString(),
      webhookUrl,
    })
  } catch (error: any) {
    console.error('Watchチャンネル登録エラー:', error)
    return NextResponse.json(
      { error: error.message || 'Watchチャンネルの登録に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * チャンネル登録状態を取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // カレンダー設定からアクティブなカレンダーIDを取得
    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('calendar_id')
      .eq('is_active', true)
      .single()

    if (!settings) {
      return NextResponse.json({ registered: false })
    }

    // チャンネル情報を取得
    const { data: channels } = await supabase
      .from('google_calendar_watch_channels')
      .select('*')
      .eq('calendar_id', settings.calendar_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!channels) {
      return NextResponse.json({ registered: false })
    }

    const isExpired = new Date(channels.expiration) < new Date()

    return NextResponse.json({
      registered: true,
      channelId: channels.channel_id,
      expiration: channels.expiration,
      isExpired,
    })
  } catch (error: any) {
    console.error('チャンネル状態取得エラー:', error)
    return NextResponse.json(
      { error: error.message || 'チャンネル状態の取得に失敗しました' },
      { status: 500 }
    )
  }
}

