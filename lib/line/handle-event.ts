import type { WebhookEvent } from '@line/bot-sdk'
import type { messagingApi } from '@line/bot-sdk'
import { getLineClient } from './client'
import { getUserState, updateUserState, resetUserState, parsePostbackData } from './state-machine'
import { recommendPlan } from './plan-recommend'
import {
  welcomeMessage,
  askUsageMessage,
  askTimeMessage,
  askAddressMessage,
  dropinMessage,
  planResultMessage,
  askBookingDatetimeMessage,
  bookingConfirmMessage,
  bookingErrorMessage,
  resetMessage,
  fallbackMessage,
} from './messages'
import { handleTextWithLLM } from './llm-handler'
import { notifyStaff } from './staff-notify'
import { logUnansweredQuestion } from './unanswered-log'
import {
  checkGoogleCalendarAvailability,
  createGoogleCalendarEvent,
} from '@/lib/utils/google-calendar'
import type { NeedsAddress, TimeSlot, UsageType } from './types'

type Message = messagingApi.Message

export async function handleEvent(event: WebhookEvent): Promise<void> {
  const client = getLineClient()

  // follow イベント（友だち追加）
  if (event.type === 'follow') {
    const userId = event.source.userId
    if (!userId) return
    await getUserState(userId) // 初回アクセスで作成
    await updateUserState(userId, { state: 'asked_usage' })
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [welcomeMessage(), askUsageMessage()],
    })
    return
  }

  // postback イベント（ボタンタップ）
  if (event.type === 'postback') {
    const userId = event.source.userId
    if (!userId) return

    const userState = await getUserState(userId)
    const params = parsePostbackData(event.postback.data)

    // 「プラン診断を始める」or リッチメニューからの開始
    if (params.action === 'start_diagnosis' || params.usage) {
      if (params.action === 'start_diagnosis') {
        await updateUserState(userId, { state: 'asked_usage' })
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [askUsageMessage()],
        })
        return
      }

      // usage 選択
      const usage = params.usage as UsageType
      if (usage === 'dropin') {
        await updateUserState(userId, { state: 'showed_plan', usage_type: 'dropin' })
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: await dropinMessage(),
        })
        return
      }
      if (usage === 'tour') {
        await updateUserState(userId, { state: 'asked_booking', usage_type: 'tour' })
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [askBookingDatetimeMessage()],
        })
        return
      }
      if (usage === 'monthly') {
        await updateUserState(userId, { state: 'asked_time', usage_type: 'monthly' })
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [askTimeMessage()],
        })
        return
      }
    }

    // time 選択
    if (params.time && userState.state === 'asked_time') {
      const timeSlot = params.time as TimeSlot
      await updateUserState(userId, { state: 'asked_address', time_slot: timeSlot })
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [askAddressMessage()],
      })
      return
    }

    // address 選択
    if (params.address && userState.state === 'asked_address') {
      const needsAddress = params.address as NeedsAddress
      const plan = await recommendPlan(userState.time_slot as TimeSlot)
      await updateUserState(userId, {
        state: 'showed_plan',
        needs_address: needsAddress,
        recommended_plan: plan.key,
      })
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: planResultMessage(plan, needsAddress),
      })
      return
    }

    // 見学予約 yes/no
    if (params.book === 'yes') {
      await updateUserState(userId, { state: 'asked_booking' })
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [askBookingDatetimeMessage()],
      })
      return
    }
    if (params.book === 'no') {
      await resetUserState(userId)
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [resetMessage()],
      })
      return
    }

    // datetimepicker からの日時選択
    if (params.action === 'pick_datetime' && event.postback.params) {
      const datetimeParam = (event.postback.params as { datetime?: string }).datetime
      if (!datetimeParam) return

      // datetimeParam は "2026-02-10T11:00" 形式
      const [dateStr, timeStr] = datetimeParam.split('T')
      const endHour = parseInt(timeStr.split(':')[0]) + 1
      const endTime = `${String(endHour).padStart(2, '0')}:${timeStr.split(':')[1]}`

      try {
        // Google Calendar に予約を作成
        const displayName = userState.display_name || 'LINE予約'
        const title = `【見学予約】${displayName}`
        const description = [
          `LINE見学予約`,
          `LINE User ID: ${userId}`,
          userState.recommended_plan ? `検討プラン: ${userState.recommended_plan}` : '',
        ].filter(Boolean).join('\n')

        const eventId = await createGoogleCalendarEvent(
          dateStr,
          timeStr,
          endTime,
          title,
          description
        )

        const bookingDatetime = new Date(`${datetimeParam}:00+09:00`).toISOString()
        await updateUserState(userId, {
          state: 'confirmed',
          booking_datetime: bookingDatetime,
          booking_event_id: eventId,
        })

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [bookingConfirmMessage(bookingDatetime)],
        })

        // 確認後にリセット
        await resetUserState(userId)
      } catch (error) {
        console.error('Booking error:', error)
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [bookingErrorMessage()],
        })
        await resetUserState(userId)
      }
      return
    }

    // 不明なpostback → フォールバック
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [fallbackMessage()],
    })
    return
  }

  // テキストメッセージ → LLMで意図判定して応答
  if (event.type === 'message' && event.message.type === 'text') {
    const userId = event.source.userId
    if (!userId) return

    console.log('[LINE] Text message received:', event.message.text, 'from:', userId)

    const userState = await getUserState(userId)
    const text = event.message.text

    // LLMで意図判定
    console.log('[LINE] Calling LLM handler...')
    const llmResponse = await handleTextWithLLM(text, userState.display_name || undefined)
    console.log('[LINE] LLM response:', llmResponse)

    // 意図に応じた処理
    if (llmResponse.intent === 'start_diagnosis') {
      // プラン診断フローを開始（既存ロジック再利用）
      await updateUserState(userId, { state: 'asked_usage' })
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [askUsageMessage()],
      })
    } else if (llmResponse.intent === 'start_booking') {
      // 見学予約フローを開始
      await updateUserState(userId, { state: 'asked_booking', usage_type: 'tour' })
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [askBookingDatetimeMessage()],
      })
    } else {
      // FAQ・リダイレクト・スタッフ依頼・挨拶・不明 → LLMの回答をそのまま返す
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: llmResponse.reply }],
      })
    }

    // スタッフ通知が必要な場合
    if (llmResponse.notify_staff) {
      await notifyStaff(
        userState.display_name || '不明',
        userId,
        text,
        llmResponse.staff_message || text
      )
    }

    // 未回答質問をログに保存（unknown or staff_request）
    if (llmResponse.intent === 'unknown' || llmResponse.intent === 'staff_request') {
      try {
        await logUnansweredQuestion({
          lineUserId: userId,
          userName: userState.display_name || undefined,
          userMessage: text,
          botReply: llmResponse.reply,
          intent: llmResponse.intent,
          staffMessage: llmResponse.staff_message,
        })
      } catch (logError) {
        console.error('[LINE] Failed to log unanswered question:', logError)
      }
    }

    return
  }
}
