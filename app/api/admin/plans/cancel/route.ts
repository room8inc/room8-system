import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { getStripeClient } from '@/lib/stripe/cancellation-fee'
import { getStripeMode } from '@/lib/stripe/mode'
import { cache, cacheKey } from '@/lib/cache/vercel-kv'

export const runtime = 'nodejs'

/**
 * 管理者によるプラン即時解除API
 * - user_plansのステータスをcancelledに更新
 * - Stripeサブスクリプションがあれば即時キャンセル
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { userPlanId, userId: targetUserId } = body

    if (!userPlanId || !targetUserId) {
      return NextResponse.json(
        { error: 'userPlanIdとuserIdが必要です' },
        { status: 400 }
      )
    }

    // 対象のプラン契約を取得
    const { data: userPlan, error: planError } = await supabase
      .from('user_plans')
      .select('id, user_id, status, stripe_subscription_id')
      .eq('id', userPlanId)
      .eq('user_id', targetUserId)
      .single()

    if (planError || !userPlan) {
      return NextResponse.json(
        { error: 'プラン情報が見つかりません' },
        { status: 404 }
      )
    }

    if (userPlan.status !== 'active') {
      return NextResponse.json(
        { error: 'アクティブなプランではありません' },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    // DB: プラン契約を終了
    const { error: updateError } = await supabase
      .from('user_plans')
      .update({
        ended_at: today,
        status: 'cancelled',
      })
      .eq('id', userPlanId)

    if (updateError) {
      return NextResponse.json(
        { error: `プラン解除に失敗しました: ${updateError.message}` },
        { status: 500 }
      )
    }

    // キャッシュクリア
    await Promise.all([
      cache.delete(cacheKey('user_plan', targetUserId)),
      cache.delete(cacheKey('user_plans_full', targetUserId)),
      cache.delete(cacheKey('user_full', targetUserId)),
    ]).catch((err) => console.warn('Cache clear failed:', err))

    // Stripe: サブスクリプションを即時キャンセル
    let stripeResult = null
    if (userPlan.stripe_subscription_id) {
      try {
        const stripeMode = await getStripeMode()
        const stripe = getStripeClient(stripeMode)
        const subscription = await stripe.subscriptions.retrieve(
          userPlan.stripe_subscription_id
        )

        if (subscription.status === 'canceled') {
          stripeResult = 'already_canceled'
        } else {
          await stripe.subscriptions.cancel(userPlan.stripe_subscription_id, {
            prorate: false,
          })
          stripeResult = 'canceled'
        }
      } catch (stripeError: any) {
        if (
          stripeError?.code === 'resource_missing' ||
          stripeError?.message?.includes('No such subscription')
        ) {
          console.warn(
            `Subscription ${userPlan.stripe_subscription_id} not found. Continuing.`
          )
          stripeResult = 'not_found'
        } else {
          console.error('Stripe cancel error:', stripeError)
          // DB更新は済んでいるのでStripeエラーは警告として返す
          return NextResponse.json({
            success: true,
            warning: `プランは解除しましたが、Stripeサブスクの解約に失敗しました: ${stripeError?.message}`,
            stripeSubscriptionId: userPlan.stripe_subscription_id,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'プランを解除しました',
      stripeResult,
    })
  } catch (error: any) {
    console.error('Admin plan cancel error:', error)
    return NextResponse.json(
      { error: error.message || 'プラン解除に失敗しました' },
      { status: 500 }
    )
  }
}
