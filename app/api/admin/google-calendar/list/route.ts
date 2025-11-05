import { NextRequest, NextResponse } from 'next/server'
import { getGoogleCalendarClientFromOAuth } from '@/lib/utils/google-calendar'

export const runtime = 'nodejs'

/**
 * Googleカレンダーの一覧を取得（OAuth認証）
 */
export async function GET(request: NextRequest) {
  try {
    // OAuth認証を使用（カレンダーIDは不要）
    const { calendar } = await getGoogleCalendarClientFromOAuth()

    // カレンダーリストを取得（すべてのカレンダーを取得）
    const response = await calendar.calendarList.list({
      // minAccessRoleを指定しないことで、すべてのカレンダーを取得
    })

    const calendars = (response.data.items || [])
      .filter((cal: any) => {
        // ownerまたはwriter権限があるカレンダーのみを表示
        return cal.accessRole === 'owner' || cal.accessRole === 'writer'
      })
      .map((cal: any) => ({
        id: cal.id,
        name: cal.summary || cal.id,
        description: cal.description || '',
        accessRole: cal.accessRole,
      }))

    return NextResponse.json({ calendars })
  } catch (error: any) {
    console.error('Google Calendar list API error:', error)
    return NextResponse.json(
      { error: error.message || 'Googleカレンダーの取得に失敗しました' },
      { status: 500 }
    )
  }
}

