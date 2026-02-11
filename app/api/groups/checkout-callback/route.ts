import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'

export const runtime = 'nodejs'

/** GET: Stripe Checkout成功後のコールバック */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.redirect(new URL('/group', request.url))
  }

  try {
    const stripeMode = await getStripeMode()
    const stripe = getStripeClient(stripeMode)
    const supabase = await createClient()

    // Checkout Sessionを取得
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.status !== 'complete') {
      console.error('Checkout session not complete:', session.status)
      return NextResponse.redirect(new URL('/plans/group?error=payment_incomplete', request.url))
    }

    const groupPlanId = session.metadata?.group_plan_id
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

    if (groupPlanId && subscriptionId) {
      // group_plans にサブスクリプションIDを保存
      await supabase
        .from('group_plans')
        .update({ stripe_subscription_id: subscriptionId })
        .eq('id', groupPlanId)

      // サブスクリプションのアイテムをスロットに紐付け
      const subscription = typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription

      if (subscription) {
        const { data: groupSlots } = await supabase
          .from('group_slots')
          .select('id, slot_number')
          .eq('group_plan_id', groupPlanId)
          .order('slot_number', { ascending: true })

        if (groupSlots) {
          for (let i = 0; i < groupSlots.length; i++) {
            if (i < subscription.items.data.length) {
              await supabase
                .from('group_slots')
                .update({
                  stripe_subscription_item_id: subscription.items.data[i].id,
                })
                .eq('id', groupSlots[i].id)
            }
          }
        }
      }

      console.log(`Group checkout complete: group=${groupPlanId}, subscription=${subscriptionId}`)
    }

    return NextResponse.redirect(new URL('/group', request.url))
  } catch (error: any) {
    console.error('Checkout callback error:', error)
    return NextResponse.redirect(new URL('/group', request.url))
  }
}
