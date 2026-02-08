export type UserState =
  | 'idle'
  | 'asked_usage'
  | 'asked_time'
  | 'asked_address'
  | 'showed_plan'
  | 'asked_booking'
  | 'confirmed'

export type UsageType = 'dropin' | 'monthly' | 'tour'

export type TimeSlot = 'day' | 'night' | 'weekend' | 'weekday' | 'night-weekend' | 'regular'

export type NeedsAddress = 'yes' | 'no' | 'unknown'

export interface LineUserState {
  id: string
  line_user_id: string
  display_name: string | null
  state: UserState
  usage_type: UsageType | null
  time_slot: TimeSlot | null
  needs_address: NeedsAddress | null
  recommended_plan: string | null
  booking_datetime: string | null
  booking_event_id: string | null
  created_at: string
  updated_at: string
}

export interface PlanInfo {
  key: string
  name: string
  timeRange: string
  basePrice: number
  addressPrice: number
}
