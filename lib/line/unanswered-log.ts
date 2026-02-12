/**
 * 未回答質問のログ保存
 */

import { createServiceClient } from '@/lib/supabase/service-client'

interface UnansweredQuestionParams {
  lineUserId: string
  userName?: string
  userMessage: string
  botReply: string
  intent: string
  staffMessage?: string
}

export async function logUnansweredQuestion(params: UnansweredQuestionParams): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('line_bot_unanswered_questions')
    .insert({
      line_user_id: params.lineUserId,
      user_name: params.userName || null,
      user_message: params.userMessage,
      bot_reply: params.botReply,
      intent: params.intent,
      staff_message: params.staffMessage || null,
    })

  if (error) {
    console.error('[UnansweredLog] Insert error:', error)
    throw error
  }
}
