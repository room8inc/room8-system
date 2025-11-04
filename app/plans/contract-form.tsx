'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ContractFormProps {
  planId: string
  planName: string
}

export function ContractForm({ planId, planName }: ContractFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => {
    // デフォルトは今日の日付
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const handleContract = async () => {
    if (!confirm(`「${planName}」で会員契約を結びますか？`)) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('ログインが必要です')
        setLoading(false)
        return
      }

      // 既存のアクティブな契約をチェック
      const { data: existingPlan } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('ended_at', null)
        .single()

      // 既存の契約がある場合は終了日を設定（プラン変更）
      if (existingPlan) {
        const { error: updateError } = await supabase
          .from('user_plans')
          .update({
            ended_at: startDate,
            status: 'changed',
          })
          .eq('id', existingPlan.id)

        if (updateError) {
          console.error('Update existing plan error:', updateError)
          setError(`既存の契約の更新に失敗しました: ${updateError.message}`)
          setLoading(false)
          return
        }
      }

      // 新しいプラン契約を作成
      const { error: insertError } = await supabase
        .from('user_plans')
        .insert({
          user_id: user.id,
          plan_id: planId,
          started_at: startDate,
          status: 'active',
        })

      if (insertError) {
        console.error('Contract insert error:', insertError)
        setError(`プラン契約に失敗しました: ${insertError.message}`)
        setLoading(false)
        return
      }

      // member_typeを'regular'に更新
      const { error: updateMemberTypeError } = await supabase
        .from('users')
        .update({
          member_type: 'regular',
        })
        .eq('id', user.id)

      if (updateMemberTypeError) {
        console.error('Update member_type error:', updateMemberTypeError)
        // member_typeの更新に失敗しても、プラン契約は成功しているので警告だけ
        console.warn('member_typeの更新に失敗しましたが、プラン契約は完了しました')
      }

      alert('会員契約が完了しました！')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Contract error:', err)
      setError('プラン契約中にエラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`startDate-${planId}`} className="block text-xs font-medium text-room-charcoal mb-1">
          契約開始日
        </label>
        <input
          id={`startDate-${planId}`}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
        />
      </div>

      {error && (
        <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-2">
          <p className="text-xs text-room-main-dark">{error}</p>
        </div>
      )}

      <button
        onClick={handleContract}
        disabled={loading}
        className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? '契約中...' : 'このプランで契約する'}
      </button>
    </div>
  )
}

