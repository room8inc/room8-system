import { createClient } from '@supabase/supabase-js'
import { getGoogleCalendarClient } from './google-calendar'
import { syncGoogleCalendarEvents } from './google-calendar-sync'

/**
 * GoogleカレンダーWatchチャンネルを再登録
 * @returns 再登録結果
 */
export async function renewWatchChannel(): Promise<{
  success: boolean
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
      return {
        success: false,
        error: 'GoogleカレンダーIDが設定されていません',
      }
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
        // エラーでも続行（既に期限切れの可能性がある）
      }
    }

    // 既存チャンネルをDBから削除
    await supabase
      .from('google_calendar_watch_channels')
      .delete()
      .eq('calendar_id', targetCalendarId)

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
      return {
        success: false,
        error: `チャンネルの保存に失敗しました: ${saveError.message}`,
      }
    }

    // 初回同期を実行（過去1日から30日後まで）
    try {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 1) // 1日前から
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 30) // 30日後まで

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const syncResult = await syncGoogleCalendarEvents(startDateStr, endDateStr)
      console.log(`チャンネル再登録後の同期完了: ${syncResult.synced}件同期, ${syncResult.errors}件エラー`)
    } catch (syncError: any) {
      console.error('チャンネル再登録後の同期エラー:', syncError)
      // 同期エラーは警告として記録するが、チャンネル登録は成功とする
    }

    return {
      success: true,
      channelId,
      resourceId: resourceId || undefined,
      expiration: expiration.toISOString(),
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
 * @param thresholdDays 再登録の閾値（残り日数、デフォルト1日）
 * @returns 再登録が実行されたかどうか
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
    // カレンダー設定からアクティブなカレンダーIDを取得
    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('calendar_id')
      .eq('is_active', true)
      .single()

    if (!settings) {
      return {
        renewed: false,
        reason: 'Googleカレンダー設定が見つかりません',
      }
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
      // チャンネルが登録されていない場合は再登録
      console.log('Watchチャンネルが登録されていません。再登録を実行します。')
      const result = await renewWatchChannel()
      return {
        renewed: result.success,
        reason: result.success ? 'チャンネルが未登録のため再登録しました' : result.error,
        channelId: result.channelId,
        expiration: result.expiration,
      }
    }

    const expirationDate = new Date(channels.expiration)
    const now = new Date()
    const daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    // 期限切れまたは閾値以内の場合、再登録
    if (daysUntilExpiration <= thresholdDays) {
      console.log(
        `Watchチャンネルの有効期限が近いため再登録します。残り日数: ${daysUntilExpiration.toFixed(2)}日`
      )
      const result = await renewWatchChannel()
      return {
        renewed: result.success,
        reason: result.success
          ? `有効期限が近いため再登録しました（残り${daysUntilExpiration.toFixed(2)}日）`
          : result.error,
        channelId: result.channelId,
        expiration: result.expiration,
      }
    }

    return {
      renewed: false,
      reason: `チャンネルは有効です（残り${daysUntilExpiration.toFixed(2)}日）`,
    }
  } catch (error: any) {
    console.error('Watchチャンネルチェックエラー:', error)
    return {
      renewed: false,
      reason: `チェックに失敗しました: ${error.message}`,
    }
  }
}

