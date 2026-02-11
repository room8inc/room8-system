import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'

export const runtime = 'nodejs'

/** POST: オーナーによるグループ解約 */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  // オーナーとして所属しているアクティブなグループを取得
  const { data: group, error: groupError } = await supabase
    .from('group_plans')
    .select('id, stripe_subscription_id')
    .eq('owner_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (groupError || !group) {
    return NextResponse.json(
      { error: 'アクティブなグループが見つかりません' },
      { status: 404 }
    )
  }

  // Stripeサブスクリプションをキャンセル
  if (group.stripe_subscription_id) {
    try {
      const stripeMode = await getStripeMode()
      const stripe = getStripeClient(stripeMode)
      await stripe.subscriptions.cancel(group.stripe_subscription_id)
    } catch (err: any) {
      console.error('Stripe subscription cancel error:', err.message)
      // Stripeエラーでも続行（DBだけでも解約する）
    }
  }

  // グループを解約済みにする
  const { error: updateError } = await supabase
    .from('group_plans')
    .update({ status: 'cancelled' })
    .eq('id', group.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
