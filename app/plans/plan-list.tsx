'use client'

import Link from 'next/link'
import { ContractForm } from './contract-form'

interface PlanListProps {
  plans: any[]
  currentPlan: any
  error: any
}

export function PlanList({ plans, currentPlan, error }: PlanListProps) {
  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5) // "HH:MM"
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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            会員契約・プラン選択
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            ご希望の時間帯プランを選択してください。オプションでシェアオフィス機能（住所利用等）を追加できます。
          </p>
        </div>

        {/* 現在の契約状況 */}
        {currentPlan && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <h2 className="text-lg font-semibold text-room-charcoal mb-2">
              現在の契約
            </h2>
            <p className="text-sm text-room-charcoal">
              {currentPlan.plans?.name || 'プラン名不明'}
            </p>
            <p className="text-xs text-room-charcoal-light mt-1">
              契約開始日: {new Date(currentPlan.started_at).toLocaleDateString('ja-JP')}
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              プラン情報の取得に失敗しました: {error.message}
            </p>
          </div>
        )}

        {/* プランが取得できていない場合 */}
        {!error && (!plans || plans.length === 0) && (
          <div className="mb-8 rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6">
            <p className="text-sm text-room-wood-dark">
              プラン情報がありません
            </p>
          </div>
        )}

        {/* プラン一覧 */}
        {plans.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan?.plan_id === plan.id

              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border-2 p-6 ${
                    isCurrentPlan
                      ? 'border-room-main bg-room-main bg-opacity-5'
                      : 'border-room-base-dark bg-room-base-light'
                  }`}
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-room-charcoal">
                      {plan.name}
                    </h3>
                    <p className="text-2xl font-bold text-room-main mt-2">
                      ¥{plan.workspace_price?.toLocaleString()}/月〜
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-room-charcoal-light mb-4">
                    <p>
                      <strong>利用時間:</strong> {formatAvailableTime(plan)}
                    </p>
                  </div>

                  {isCurrentPlan ? (
                    <div className="rounded-md bg-room-main bg-opacity-20 p-3 text-center">
                      <p className="text-sm font-medium text-room-main-dark">
                        現在のプラン
                      </p>
                    </div>
                  ) : (
                    <ContractForm
                      planId={plan.id}
                      planName={plan.name}
                      planPrice={plan.workspace_price}
                      planData={plan}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
