import { google } from 'googleapis'

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
 * Google Calendar APIクライアントを取得（データベースからカレンダーIDを取得）
 */
export async function getGoogleCalendarClient() {
  const { calendar } = getGoogleCalendarClientFromEnv()
  
  // データベースからアクティブなカレンダーIDを取得
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabaseの環境変数が設定されていません')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: settings, error } = await supabase
    .from('google_calendar_settings')
    .select('calendar_id')
    .eq('is_active', true)
    .single()

  if (error || !settings) {
    // データベースに設定がない場合は環境変数から取得（後方互換性）
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    if (!calendarId) {
      throw new Error('GoogleカレンダーIDが設定されていません。管理画面でカレンダーを選択してください。')
    }
    return { calendar, calendarId }
  }

  return { calendar, calendarId: settings.calendar_id }
}

/**
 * Googleカレンダーから指定日時の予定を取得して、空き状況をチェック
 * @param date 予約日（YYYY-MM-DD形式）
 * @param startTime 開始時刻（HH:mm形式）
 * @param endTime 終了時刻（HH:mm形式）
 * @returns 空きがある場合はtrue、予定がある場合はfalse
 */
export async function checkGoogleCalendarAvailability(
  date: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const { calendar, calendarId } = await getGoogleCalendarClient()

    // 日時をISO形式に変換
    const startDateTime = new Date(`${date}T${startTime}:00+09:00`)
    const endDateTime = new Date(`${date}T${endTime}:00+09:00`)

    // Googleカレンダーから予定を取得
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items || []

    // 時間が重複している予定があるかチェック
    if (events.length > 0) {
      return {
        available: false,
        reason: 'この時間帯はGoogleカレンダーに予定が入っています',
      }
    }

    return { available: true }
  } catch (error: any) {
    console.error('Google Calendar availability check error:', error)
    // エラーが発生した場合は、予約を許可しない（安全側に倒す）
    return {
      available: false,
      reason: `Googleカレンダーの確認中にエラーが発生しました: ${error.message}`,
    }
  }
}

/**
 * Googleカレンダーにイベントを追加
 * @param date 予約日（YYYY-MM-DD形式）
 * @param startTime 開始時刻（HH:mm形式）
 * @param endTime 終了時刻（HH:mm形式）
 * @param title イベントタイトル
 * @param description イベント説明（任意）
 * @returns 作成されたイベントID
 */
export async function createGoogleCalendarEvent(
  date: string,
  startTime: string,
  endTime: string,
  title: string,
  description?: string
): Promise<string> {
  try {
    const { calendar, calendarId } = await getGoogleCalendarClient()

    // 日時をISO形式に変換（日本時間）
    const startDateTime = new Date(`${date}T${startTime}:00+09:00`)
    const endDateTime = new Date(`${date}T${endTime}:00+09:00`)

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
 * @param eventId イベントID
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  try {
    const { calendar, calendarId } = await getGoogleCalendarClient()

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
    })
  } catch (error: any) {
    console.error('Google Calendar event deletion error:', error)
    // エラーが発生しても例外を投げない（削除は失敗しても致命的ではない）
    console.warn(`Googleカレンダーからの予定削除に失敗しました: ${error.message}`)
  }
}

