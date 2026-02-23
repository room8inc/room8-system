import { google } from 'googleapis'

export type CalendarRole = 'meeting_room' | 'personal'

/**
 * Google Calendar APIクライアントを取得（環境変数から）
 */
export function getGoogleCalendarClientFromEnv() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let privateKey = process.env.GOOGLE_PRIVATE_KEY

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Calendarの環境変数（GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY）が設定されていません')
  }

  // Private Keyの処理: 複数の形式に対応
  // 1. Base64エンコードされた場合（GOOGLE_PRIVATE_KEY_BASE64が設定されている場合）
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
      const parsed = JSON.parse(decoded)
      privateKey = parsed.private_key || privateKey
    } catch (error) {
      console.warn('Base64デコードに失敗しました。通常の形式で処理します:', error)
    }
  }

  // 2. 改行文字の処理: 複数の形式に対応
  // - `\\n` (エスケープされた改行) → 実際の改行に変換
  // - すでに実際の改行がある場合はそのまま使用
  if (privateKey && !privateKey.includes('\n')) {
    // エスケープされた改行文字を実際の改行に変換
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  // Private Keyの形式を検証
  if (!privateKey || (!privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY'))) {
    throw new Error(
      'GOOGLE_PRIVATE_KEYの形式が正しくありません。\n' +
      'JSONファイルの`private_key`フィールドの値を、改行文字（\\n）を含めてそのまま設定してください。\n' +
      'または、Base64エンコードされたJSON全体をGOOGLE_PRIVATE_KEY_BASE64に設定することもできます。'
    )
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar'],
    })

    const calendar = google.calendar({ version: 'v3', auth })

    return { calendar }
  } catch (error: any) {
    // より詳細なエラーメッセージを提供
    if (error.message?.includes('DECODER') || error.message?.includes('unsupported')) {
      throw new Error(
        'GOOGLE_PRIVATE_KEYのデコードに失敗しました。\n' +
        '環境変数の設定方法を確認してください：\n' +
        '1. JSONファイルの`private_key`フィールドの値を、改行文字（\\n）を含めてそのまま設定\n' +
        '2. または、JSON全体をBase64エンコードしてGOOGLE_PRIVATE_KEY_BASE64に設定\n' +
        '3. Vercelの場合、環境変数設定画面で実際の改行を入力するか、\\nをエスケープして入力\n' +
        `元のエラー: ${error.message}`
      )
    }
    throw error
  }
}

/**
 * Google Calendar APIクライアントを取得（OAuth認証トークンから）
 */
export async function getGoogleCalendarClientFromOAuth() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabaseの環境変数が設定されていません')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // アクティブなOAuthトークンを取得
  const { data: tokenData, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !tokenData) {
    throw new Error('OAuth認証トークンが見つかりません。管理画面でGoogleアカウントに接続してください。')
  }

  // トークンの有効期限チェック
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    // トークンが期限切れの場合、リフレッシュトークンで更新
    if (tokenData.refresh_token) {
      const refreshedToken = await refreshOAuthToken(tokenData.refresh_token)
      if (refreshedToken) {
        // 更新されたトークンを使用
        const auth = new google.auth.OAuth2()
        auth.setCredentials({
          access_token: refreshedToken.access_token,
          refresh_token: refreshedToken.refresh_token || tokenData.refresh_token,
        })
        const calendar = google.calendar({ version: 'v3', auth })
        return { calendar, auth }
      }
    }
    throw new Error('OAuth認証トークンが期限切れです。管理画面で再認証してください。')
  }

  // アクセストークンを使用
  const auth = new google.auth.OAuth2()
  auth.setCredentials({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || undefined,
  })

  const calendar = google.calendar({ version: 'v3', auth })

  return { calendar, auth }
}

/**
 * OAuthトークンをリフレッシュ
 */
async function refreshOAuthToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('OAuth設定が不完全です')
    return null
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text())
      return null
    }

    const tokenData = await response.json()

    // データベースに保存
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null

      await supabase
        .from('google_oauth_tokens')
        .update({
          access_token: tokenData.access_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('refresh_token', refreshToken)
    }

    return tokenData
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

/**
 * APIクライアント（認証部分）を取得する内部ヘルパー
 */
async function getCalendarApiClient() {
  let calendar: any

  // まずOAuthトークンを試す（設定されている場合）
  try {
    const oauthClient = await getGoogleCalendarClientFromOAuth()
    calendar = oauthClient.calendar
  } catch (oauthError) {
    // OAuthが設定されていない場合はService Accountを使用
    console.log('OAuth認証が設定されていません。Service Accountを使用します。')
    const envClient = getGoogleCalendarClientFromEnv()
    calendar = envClient.calendar
  }

  return calendar
}

/**
 * Supabaseクライアントを取得する内部ヘルパー
 */
async function getSupabaseAdmin() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabaseの環境変数が設定されていません')
  }

  return createClient(supabaseUrl, supabaseKey)
}

/**
 * 指定されたロールのカレンダー設定を取得
 */
export async function getCalendarByRole(role: CalendarRole): Promise<{ calendar: any; calendarId: string; calendarRole: CalendarRole } | null> {
  const calendar = await getCalendarApiClient()
  const supabase = await getSupabaseAdmin()

  const { data: settings } = await supabase
    .from('google_calendar_settings')
    .select('calendar_id, calendar_role')
    .eq('is_active', true)
    .eq('calendar_role', role)
    .single()

  if (!settings) {
    return null
  }

  return { calendar, calendarId: settings.calendar_id, calendarRole: role }
}

/**
 * 全アクティブカレンダーの設定を取得
 */
export async function getAllActiveCalendars(): Promise<Array<{ calendar: any; calendarId: string; calendarRole: CalendarRole; calendarName?: string }>> {
  const calendar = await getCalendarApiClient()
  const supabase = await getSupabaseAdmin()

  const { data: settings } = await supabase
    .from('google_calendar_settings')
    .select('calendar_id, calendar_role, calendar_name')
    .eq('is_active', true)

  if (!settings || settings.length === 0) {
    // 環境変数にフォールバック
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    if (calendarId) {
      return [{ calendar, calendarId, calendarRole: 'meeting_room' }]
    }
    return []
  }

  return settings.map(s => ({
    calendar,
    calendarId: s.calendar_id,
    calendarRole: s.calendar_role as CalendarRole,
    calendarName: s.calendar_name,
  }))
}

/**
 * Google Calendar APIクライアントを取得（データベースからカレンダーIDを取得）
 * デフォルトは meeting_room ロール（後方互換性）
 */
export async function getGoogleCalendarClient(role: CalendarRole = 'meeting_room') {
  const result = await getCalendarByRole(role)

  if (result) {
    return { calendar: result.calendar, calendarId: result.calendarId }
  }

  // ロール指定で見つからない場合、is_active=trueの最初のカレンダーを取得（後方互換性）
  const calendar = await getCalendarApiClient()
  const supabase = await getSupabaseAdmin()

  const { data: settings } = await supabase
    .from('google_calendar_settings')
    .select('calendar_id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (settings) {
    return { calendar, calendarId: settings.calendar_id }
  }

  // データベースに設定がない場合は環境変数から取得（後方互換性）
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!calendarId) {
    throw new Error('GoogleカレンダーIDが設定されていません。管理画面でカレンダーを選択してください。')
  }
  return { calendar, calendarId }
}

/**
 * Googleカレンダーから指定日時の予定を取得して、空き状況をチェック
 */
export async function checkGoogleCalendarAvailability(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const { calendar, calendarId } = await getGoogleCalendarClient()

    // 日時をISO形式に変換（日本時間）
    const startDateTime = new Date(`${date}T${startTime}:00+09:00`)
    const endDateTime = new Date(`${date}T${endTime}:00+09:00`)

    // その日の0時から23時59分59秒まで（日本時間）を取得範囲とする
    const dayStart = new Date(`${date}T00:00:00+09:00`)
    const dayEnd = new Date(`${date}T23:59:59+09:00`)

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items || []

    // 時間が重複している予定があるかチェック
    for (const event of events) {
      const eventStart = event.start?.dateTime ? new Date(event.start.dateTime) : null
      const eventEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null

      if (!eventStart || !eventEnd) continue

      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const eventDateStr = formatter.format(eventStart)

      if (eventDateStr !== date) continue

      const overlaps = startDateTime.getTime() < eventEnd.getTime() && endDateTime.getTime() > eventStart.getTime()

      if (overlaps) {
        return {
          available: false,
          reason: `この時間帯はGoogleカレンダーに予定が入っています（${event.summary || '予定あり'}）`,
        }
      }
    }

    return { available: true }
  } catch (error: any) {
    console.error('Google Calendar availability check error:', error)
    return {
      available: false,
      reason: `Googleカレンダーの確認中にエラーが発生しました: ${error.message}`,
    }
  }
}

/**
 * Googleカレンダーにイベントを追加
 * @param calendarRole 追加先のカレンダーロール（デフォルト: meeting_room）
 */
export async function createGoogleCalendarEvent(
  date: string,
  startTime: string,
  endTime: string,
  title: string,
  description?: string,
  calendarRole: CalendarRole = 'meeting_room'
): Promise<string> {
  try {
    const { calendar, calendarId } = await getGoogleCalendarClient(calendarRole)

    const normalizeTime = (time: string) => {
      if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
        return time.slice(0, 5)
      }
      return time
    }

    const normalizedStart = normalizeTime(startTime)
    const normalizedEnd = normalizeTime(endTime)

    // 日時をISO形式に変換（日本時間）
    const startDateTime = new Date(`${date}T${normalizedStart}:00+09:00`)
    const endDateTime = new Date(`${date}T${normalizedEnd}:00+09:00`)

    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
      throw new Error(
        `Invalid time value: date=${date}, startTime=${startTime}, endTime=${endTime}`
      )
    }

    // Googleカレンダーにイベントを追加
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: title,
        description: description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Asia/Tokyo',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Tokyo',
        },
      },
    })

    const eventId = response.data.id
    if (!eventId) {
      throw new Error('Googleカレンダーイベントの作成に失敗しました')
    }

    return eventId
  } catch (error: any) {
    console.error('Google Calendar event creation error:', error)
    throw new Error(`Googleカレンダーへの予定追加に失敗しました: ${error.message}`)
  }
}

/**
 * Googleカレンダーからイベントを削除
 */
export async function deleteGoogleCalendarEvent(eventId: string, calendarRole: CalendarRole = 'meeting_room'): Promise<void> {
  try {
    const { calendar, calendarId } = await getGoogleCalendarClient(calendarRole)

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
    })
  } catch (error: any) {
    console.error('Google Calendar event deletion error:', error)
    console.warn(`Googleカレンダーからの予定削除に失敗しました: ${error.message}`)
  }
}
