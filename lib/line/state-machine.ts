import { createServiceClient } from '@/lib/supabase/service-client'
import type { LineUserState, UserState, UsageType, TimeSlot, NeedsAddress } from './types'

const supabase = createServiceClient()

export async function getUserState(lineUserId: string): Promise<LineUserState> {
  const { data, error } = await supabase
    .from('line_user_states')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single()

  if (error || !data) {
    // 新規ユーザー → 作成
    const { data: newUser, error: insertError } = await supabase
      .from('line_user_states')
      .insert({ line_user_id: lineUserId, state: 'idle' })
      .select()
      .single()

    if (insertError || !newUser) {
      console.error('Failed to create user state:', insertError)
      // フォールバック: メモリ上のデフォルト
      return {
        id: '',
        line_user_id: lineUserId,
        display_name: null,
        state: 'idle',
        usage_type: null,
        time_slot: null,
        needs_address: null,
        recommended_plan: null,
        booking_datetime: null,
        booking_event_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }
    return newUser as LineUserState
  }

  return data as LineUserState
}

export async function updateUserState(
  lineUserId: string,
  updates: Partial<Pick<LineUserState, 'state' | 'display_name' | 'usage_type' | 'time_slot' | 'needs_address' | 'recommended_plan' | 'booking_datetime' | 'booking_event_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('line_user_states')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('line_user_id', lineUserId)

  if (error) {
    console.error('Failed to update user state:', error)
  }
}

export async function resetUserState(lineUserId: string): Promise<void> {
  await updateUserState(lineUserId, {
    state: 'idle',
    usage_type: null,
    time_slot: null,
    needs_address: null,
    recommended_plan: null,
    booking_datetime: null,
    booking_event_id: null,
  })
}

export function parsePostbackData(data: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const pair of data.split('&')) {
    const [key, value] = pair.split('=')
    if (key && value) {
      params[key] = value
    }
  }
  return params
}
