'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { NormalizedPlanRecord } from '@/lib/utils/user-plans'

interface UserPlanManagementProps {
  userId: string
  currentPlan: NormalizedPlanRecord | null
  planHistory: NormalizedPlanRecord[]
  plans: any[]
}

export function UserPlanManagement({
  userId,
  currentPlan,
  planHistory,
  plans,
}: UserPlanManagementProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const currentPlanDetail = currentPlan?.currentPlanDetail ?? currentPlan?.plans ?? null
  const upcomingPlanDetail = currentPlan?.newPlanDetail ?? null

  const formatPlanName = (plan: any) => plan?.name || 'プラン名不明'

  const handleChangePlan = async () => {
    if (!selectedPlanId) {
      setError('プランを選択してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 既存のアクティブな契約を終了
      if (currentPlan) {
        const { error: updateError } = await supabase
          .from('user_plans')
          .update({
            ended_at: startDate,
            status: 'changed',
          })
          .eq('id', currentPlan.id)

        if (updateError) {
          throw new Error(`既存の契約の更新に失敗しました: ${updateError.message}`)
        }
      }

      // 新しいプラン契約を作成
      const { error: insertError } = await supabase
        .from('user_plans')
        .insert({
          user_id: userId,
          plan_id: selectedPlanId,
          started_at: startDate,
          status: 'active',
        })

      if (insertError) {
        throw new Error(`プラン契約に失敗しました: ${insertError.message}`)
      }

      // member_typeを'regular'に更新
      await supabase
        .from('users')
        .update({
          member_type: 'regular',
        })
        .eq('id', userId)

      router.refresh()
      setShowChangePlan(false)
      setSelectedPlanId('')
    } catch (err) {
      console.error('Change plan error:', err)
      setError(err instanceof Error ? err.message : 'プラン変更に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelPlan = async () => {
    if (!confirm('現在のプラン契約を解除しますか？')) {
      return
    }

    if (!currentPlan) {
      setError('現在のプラン情報が取得できませんでした')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const today = new Date().toISOString().split('T')[0]

      // プラン契約を終了
      const { error: updateError } = await supabase
        .from('user_plans')
        .update({
          ended_at: today,
          status: 'cancelled',
        })
        .eq('id', currentPlan.id)

      if (updateError) {
        throw new Error(`プラン契約の解除に失敗しました: ${updateError.message}`)
      }

      // member_typeを'dropin'に更新
      await supabase
        .from('users')
        .update({
          member_type: 'dropin',
        })
        .eq('id', userId)

      router.refresh()
    } catch (err) {
      console.error('Cancel plan error:', err)
      setError(err instanceof Error ? err.message : 'プラン契約の解除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 現在のプラン契約 */}
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-room-charcoal">
            現在のプラン契約
          </h2>
          {currentPlan && currentPlan.status !== 'cancelled' && (
            <button
              onClick={handleCancelPlan}
              disabled={loading}
              className="text-sm text-room-main hover:text-room-main-light disabled:opacity-50"
            >
              プラン解除
            </button>
          )}
        </div>

        {currentPlan ? (
          <div className="space-y-2">
            <p className="text-sm text-room-charcoal">
              <strong>プラン名:</strong> {formatPlanName(currentPlanDetail)}
            </p>
            <p className="text-sm text-room-charcoal-light">
              <strong>契約開始日:</strong> {new Date(currentPlan.started_at).toLocaleDateString('ja-JP')}
            </p>
            <p className="text-sm text-room-charcoal-light">
              <strong>月額料金:</strong> ¥{currentPlanDetail?.price?.toLocaleString() || '不明'}
            </p>
            {currentPlan.status === 'cancelled' && currentPlan.cancellation_scheduled_date && (
              <p className="text-sm text-room-main-dark">
                <strong>解約予定日:</strong>{' '}
                {new Date(currentPlan.cancellation_scheduled_date).toLocaleDateString('ja-JP')}
              </p>
            )}
            {upcomingPlanDetail && (
              <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
                <p className="text-xs text-room-main-dark font-semibold">プラン変更が申請されています</p>
                <p className="text-xs text-room-main-dark">
                  <strong>次のプラン:</strong> {formatPlanName(upcomingPlanDetail)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-room-charcoal-light">
            プラン契約がありません
          </p>
        )}
      </div>

      {/* プラン変更 */}
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-room-charcoal">
            プラン変更
          </h2>
          {!showChangePlan && (
            <button
              onClick={() => setShowChangePlan(true)}
              className="text-sm text-room-main hover:text-room-main-light"
            >
              プランを変更する
            </button>
          )}
        </div>

        {showChangePlan && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-room-charcoal mb-2">
                新しいプラン
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              >
                <option value="">プランを選択してください</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - ¥{plan.price.toLocaleString()}/月
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-room-charcoal mb-2">
                契約開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {error && (
              <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
                <p className="text-xs text-room-main-dark">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleChangePlan}
                disabled={loading || !selectedPlanId}
                className="flex-1 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? '変更中...' : 'プランを変更する'}
              </button>
              <button
                onClick={() => {
                  setShowChangePlan(false)
                  setSelectedPlanId('')
                  setError(null)
                }}
                disabled={loading}
                className="flex-1 rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal focus:outline-none focus:ring-2 focus:ring-room-charcoal focus:ring-offset-2 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {/* プラン契約履歴 */}
      {planHistory.length > 0 && (
        <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            プラン契約履歴
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-room-base-dark">
              <thead className="bg-room-base-dark">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase">
                    プラン名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase">
                    開始日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase">
                    終了日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-room-charcoal uppercase">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-room-base-dark">
                {planHistory.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-3 text-sm text-room-charcoal">
                      {formatPlanName(plan.currentPlanDetail ?? plan.plans)}
                      {plan.newPlanDetail && (
                        <span className="block text-xs text-room-main-dark mt-1">
                          次のプラン: {formatPlanName(plan.newPlanDetail)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-room-charcoal-light">
                      {new Date(plan.started_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-sm text-room-charcoal-light">
                      {plan.ended_at
                        ? new Date(plan.ended_at).toLocaleDateString('ja-JP')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          plan.status === 'active'
                            ? 'bg-room-main text-white'
                            : plan.status === 'cancelled'
                            ? 'bg-room-charcoal-light text-white'
                            : 'bg-room-wood text-white'
                        }`}
                      >
                        {plan.status === 'active'
                          ? 'アクティブ'
                          : plan.status === 'cancelled'
                          ? '解除'
                          : '変更'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

