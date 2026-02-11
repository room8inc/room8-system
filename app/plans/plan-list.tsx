'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface PlanListProps {
  plans: any[]
  currentPlan: any
  error: any
}

export function PlanList({ plans, currentPlan, error }: PlanListProps) {
  const router = useRouter()

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  const formatAvailableTime = (plan: any) => {
    const hasWeekday = plan.weekday_start_time && plan.weekday_end_time
    const hasWeekend = plan.weekend_start_time && plan.weekend_end_time

    if (hasWeekday && hasWeekend) {
      return `平日 ${formatTime(plan.weekday_start_time)}〜${formatTime(plan.weekday_end_time)} / 土日祝 ${formatTime(plan.weekend_start_time)}〜${formatTime(plan.weekend_end_time)}`
    } else if (hasWeekday) {
      return `平日 ${formatTime(plan.weekday_start_time)}〜${formatTime(plan.weekday_end_time)}`
    } else if (hasWeekend) {
      return `土日祝 ${formatTime(plan.weekend_start_time)}〜${formatTime(plan.weekend_end_time)}`
    }
    return '—'
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            いつ使いますか？
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            利用したい時間帯を選んでください
          </p>
        </div>

        {/* 現在の契約状況 */}
        {currentPlan && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-charcoal">
              現在の契約: <span className="font-medium">{currentPlan.plans?.name || 'プラン名不明'}</span>
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">
              プラン情報の取得に失敗しました
            </p>
          </div>
        )}

        {/* プラン選択 */}
        {plans.length > 0 && (
          <div className="space-y-3">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan?.plan_id === plan.id

              return (
                <button
                  key={plan.id}
                  onClick={() => {
                    if (!isCurrentPlan) {
                      router.push(`/plans/configure?planId=${plan.id}`)
                    }
                  }}
                  disabled={isCurrentPlan}
                  className={`w-full text-left rounded-lg border-2 p-5 transition-all ${
                    isCurrentPlan
                      ? 'border-room-main bg-room-main bg-opacity-5 cursor-default'
                      : 'border-room-base-dark bg-room-base-light hover:border-room-main hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-room-charcoal">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-room-charcoal-light mt-1">
                        {formatAvailableTime(plan)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-room-main">
                        ¥{plan.workspace_price?.toLocaleString()}
                        <span className="text-xs font-normal text-room-charcoal-light">/月〜</span>
                      </p>
                      {isCurrentPlan && (
                        <span className="text-xs text-room-main font-medium">現在のプラン</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* グループプラン案内 */}
        <div className="mt-8 rounded-lg border-2 border-dashed border-room-base-dark bg-room-base-light p-6">
          <h2 className="text-lg font-bold text-room-charcoal">
            家族・法人でご利用の方
          </h2>
          <p className="mt-2 text-sm text-room-charcoal-light">
            複数人でシェアできるグループプラン。2人目以降は50% OFFでご利用いただけます。
          </p>
          <button
            onClick={() => router.push('/plans/group')}
            className="mt-4 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
          >
            グループプランを見る
          </button>
        </div>

        {!error && (!plans || plans.length === 0) && (
          <div className="rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6">
            <p className="text-sm text-room-wood-dark">プラン情報がありません</p>
          </div>
        )}
      </div>
    </div>
  )
}
