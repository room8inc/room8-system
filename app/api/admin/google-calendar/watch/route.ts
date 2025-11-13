import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { renewWatchChannel } from '@/lib/utils/google-calendar-watch'

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

    // 共通関数を使用してチャンネルを再登録
    const result = await renewWatchChannel()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Watchチャンネルの登録に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      channelId: result.channelId,
      resourceId: result.resourceId,
      expiration: result.expiration,
      webhookUrl: result.webhookUrl,
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

    // Webhook URLを構築
    // NEXT_PUBLIC_SITE_URLを優先（本番環境のURL）
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    
    if (!baseUrl) {
      // フォールバック: 本番環境のURLを推測
      if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('vercel.app')) {
        // カスタムドメインの場合
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        // プレビュー環境の場合は警告を出す
        console.warn('NEXT_PUBLIC_SITE_URLが設定されていません。プレビュー環境のURLが使用されます。')
        baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }
    }

    const webhookUrl = `${baseUrl}/api/calendar/webhook-v2`

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
      webhookUrl, // Webhook URLを追加
    })
  } catch (error: any) {
    console.error('チャンネル状態取得エラー:', error)
    return NextResponse.json(
      { error: error.message || 'チャンネル状態の取得に失敗しました' },
      { status: 500 }
    )
  }
}

