import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * プラン変更申請API
 * 
 * 15日までに申請すれば翌月1日から適用
 * または指定日から適用
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
    const { userPlanId, newPlanId, changeDate } = body

    if (!userPlanId || !newPlanId || !changeDate) {
      return NextResponse.json(
        { error: 'userPlanId、newPlanId、changeDateが必要です' },
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

    // 変更先プランを確認
    const { data: newPlan, error: newPlanError } = await supabase
      .from('plans')
      .select('id, name, is_active')
      .eq('id', newPlanId)
      .eq('is_active', true)
      .single()

    if (newPlanError || !newPlan) {
      return NextResponse.json(
        { error: '変更先プランが見つかりません' },
        { status: 404 }
      )
    }

    // プラン変更予定日を設定
    const { error: updateError } = await supabase
      .from('user_plans')
      .update({
        plan_change_scheduled_date: changeDate,
        new_plan_id: newPlanId,
      })
      .eq('id', userPlanId)

    if (updateError) {
      console.error('Plan change update error:', updateError)
      return NextResponse.json(
        { error: 'プラン変更申請の更新に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'プラン変更申請が完了しました',
      changeDate,
      newPlanName: newPlan.name,
    })
  } catch (error: any) {
    console.error('Plan change API error:', error)
    return NextResponse.json(
      { error: error.message || 'プラン変更申請に失敗しました' },
      { status: 500 }
    )
  }
}

