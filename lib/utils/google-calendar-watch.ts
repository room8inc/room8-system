import { createClient } from '@supabase/supabase-js'
import { getAllActiveCalendars } from './google-calendar'
import { syncGoogleCalendarEvents } from './google-calendar-sync'

/**
 * 全アクティブカレンダーにWatchチャンネルを登録
 */
export async function renewWatchChannel(): Promise<{
  success: boolean
  results?: Array<{ calendarRole: string; channelId: string; expiration: string }>
  channelId?: string
  resourceId?: string
  expiration?: string
  webhookUrl?: string
  error?: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      error: 'Supabaseの環境変数が設定されていません',
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const activeCalendars = await getAllActiveCalendars()

    if (activeCalendars.length === 0) {
      return {
        success: false,
        error: 'アクティブなカレンダーが設定されていません',
      }
    }

    // Webhook URLを構築
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!baseUrl) {
      if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('vercel.app')) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        console.warn('NEXT_PUBLIC_SITE_URLが設定されていません。プレビュー環境のURLが使用されます。')
        baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }
    }

    const webhookUrl = `${baseUrl}/api/calendar/webhook-v2`
    const results: Array<{ calendarRole: string; channelId: string; expiration: string }> = []

    for (const { calendar, calendarId, calendarRole } of activeCalendars) {
      // 既存のチャンネルを停止
      const { data: existingChannels } = await supabase
        .from('google_calendar_watch_channels')
        .select('channel_id, resource_id')
        .eq('calendar_id', calendarId)

      for (const channel of existingChannels || []) {
        try {
          await calendar.channels.stop({
            requestBody: {
              id: channel.channel_id,
              resourceId: channel.resource_id,
            },
          })
        } catch (err) {
          console.error(`既存チャンネルの停止エラー (${calendarRole}):`, err)
        }
      }

      // 既存チャンネルをDBから削除
      await supabase
        .from('google_calendar_watch_channels')
        .delete()
        .eq('calendar_id', calendarId)

      // チャンネルIDとトークンを生成
      const channelId = `channel-${calendarRole}-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const token = Math.random().toString(36).substring(7)

      // Watchチャンネルを登録
      const watchResponse = await calendar.events.watch({
        calendarId,
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
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      // DBに保存
      const { error: saveError } = await supabase
        .from('google_calendar_watch_channels')
        .insert({
          calendar_id: calendarId,
          channel_id: channelId,
          resource_id: resourceId || '',
          expiration: expiration.toISOString(),
        })

      if (saveError) {
        console.error(`チャンネル保存エラー (${calendarRole}):`, saveError)
      } else {
        console.log(`Watchチャンネル登録: ${calendarRole} (${calendarId})`)
        results.push({
          calendarRole,
          channelId,
          expiration: expiration.toISOString(),
        })
      }
    }

    // 初回同期を実行
    try {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 1)
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 30)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const syncResult = await syncGoogleCalendarEvents(startDateStr, endDateStr)
      console.log(`チャンネル再登録後の同期完了: ${syncResult.synced}件同期, ${syncResult.errors}件エラー, ${syncResult.calendars}カレンダー`)
    } catch (syncError: any) {
      console.error('チャンネル再登録後の同期エラー:', syncError)
    }

    // 後方互換性: 最初の結果をトップレベルにも返す
    const firstResult = results[0]

    return {
      success: true,
      results,
      channelId: firstResult?.channelId,
      expiration: firstResult?.expiration,
      webhookUrl,
    }
  } catch (error: any) {
    console.error('Watchチャンネル再登録エラー:', error)
    return {
      success: false,
      error: error.message || 'Watchチャンネルの再登録に失敗しました',
    }
  }
}

/**
 * Watchチャンネルの有効期限をチェックし、必要に応じて再登録
 */
export async function checkAndRenewWatchChannel(thresholdDays: number = 1): Promise<{
  renewed: boolean
  reason?: string
  channelId?: string
  expiration?: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      renewed: false,
      reason: 'Supabaseの環境変数が設定されていません',
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // 全アクティブカレンダーの設定を取得
    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('calendar_id')
      .eq('is_active', true)

    if (!settings || settings.length === 0) {
      return {
        renewed: false,
        reason: 'Googleカレンダー設定が見つかりません',
      }
    }

    // 各カレンダーのチャンネルを確認
    let needsRenewal = false

    for (const setting of settings) {
      const { data: channel } = await supabase
        .from('google_calendar_watch_channels')
        .select('*')
        .eq('calendar_id', setting.calendar_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!channel) {
        needsRenewal = true
        break
      }

      const expirationDate = new Date(channel.expiration)
      const daysUntilExpiration = (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)

      if (daysUntilExpiration <= thresholdDays) {
        needsRenewal = true
        break
      }
    }

    if (needsRenewal) {
      console.log('Watchチャンネルの再登録が必要です')
      const result = await renewWatchChannel()
      return {
        renewed: result.success,
        reason: result.success ? 'チャンネルを再登録しました' : result.error,
        channelId: result.channelId,
        expiration: result.expiration,
      }
    }

    return {
      renewed: false,
      reason: '全チャンネルが有効です',
    }
  } catch (error: any) {
    console.error('Watchチャンネルチェックエラー:', error)
    return {
      renewed: false,
      reason: `チェックに失敗しました: ${error.message}`,
    }
  }
}
