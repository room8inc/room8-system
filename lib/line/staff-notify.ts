import { getLineClient } from './client'

/**
 * スタッフにLINE Push Messageで通知を送る
 * LINE_STAFF_GROUP_ID または LINE_STAFF_USER_ID が設定されている場合に通知
 * どちらも未設定の場合はログ出力のみ
 */
export async function notifyStaff(
  userName: string,
  userId: string,
  originalMessage: string,
  summary: string
): Promise<void> {
  const groupId = process.env.LINE_STAFF_GROUP_ID
  const staffUserId = process.env.LINE_STAFF_USER_ID
  const targetId = groupId || staffUserId

  const notificationText = [
    `[LINE通知] ${userName}さんからのメッセージ:`,
    originalMessage,
    '',
    `要約: ${summary}`,
    '',
    `User ID: ${userId}`,
  ].join('\n')

  if (!targetId) {
    console.log('[staff-notify] 通知先が未設定のためログ出力のみ:', notificationText)
    return
  }

  try {
    const client = getLineClient()
    await client.pushMessage({
      to: targetId,
      messages: [
        {
          type: 'text',
          text: notificationText,
        },
      ],
    })
    console.log('[staff-notify] スタッフ通知送信完了:', targetId)
  } catch (error) {
    // 通知失敗はユーザー応答に影響させない
    console.error('[staff-notify] スタッフ通知送信エラー:', error)
  }
}
