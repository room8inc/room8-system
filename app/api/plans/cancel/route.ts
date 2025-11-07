import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 退会申請API
 * 
 * 15日までに申請すれば翌月1日から適用
 * 長期契約割引（年契約）の場合は解約料金が必要
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

    const body = await request.json()
    const { userPlanId, cancellationDate, cancellationFee } = body

    if (!userPlanId || !cancellationDate) {
      return NextResponse.json(
        { error: 'userPlanIdとcancellationDateが必要です' },
        { status: 400 }
      )
    }

    // 現在のプランを確認
    const { data: currentPlan, error: planError } = await supabase
      .from('user_plans')
      .select('id, user_id, status')
      .eq('id', userPlanId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('ended_at', null)
      .single()

    if (planError || !currentPlan) {
      return NextResponse.json(
        { error: 'プラン情報が見つかりません' },
        { status: 404 }
      )
    }

    // 解約予定日を設定
    // 解約料金がある場合は、支払い済みフラグをfalseに設定
    const { error: updateError } = await supabase
      .from('user_plans')
      .update({
        cancellation_scheduled_date: cancellationDate,
        cancellation_fee: cancellationFee || 0,
        cancellation_fee_paid: cancellationFee === 0 || !cancellationFee,
      })
      .eq('id', userPlanId)

    if (updateError) {
      console.error('Cancellation update error:', updateError)
      return NextResponse.json(
        { error: '退会申請の更新に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '退会申請が完了しました',
      cancellationDate,
      cancellationFee: cancellationFee || 0,
    })
  } catch (error: any) {
    console.error('Cancellation API error:', error)
    return NextResponse.json(
      { error: error.message || '退会申請に失敗しました' },
      { status: 500 }
    )
  }
}

