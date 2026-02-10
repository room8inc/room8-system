'use client'

import Link from 'next/link'
import { ContractForm } from './contract-form'

interface PlanListProps {
  planType: 'workspace' | 'shared_office'
  plans: any[]
  currentPlan: any
  error: any
}

export function PlanList({ planType, plans, currentPlan, error }: PlanListProps) {
  const planTypeName =
    planType === 'shared_office' ? 'シェアオフィスプラン' : 'ワークスペースプラン'
  const planTypeDescription =
    planType === 'shared_office'
      ? '住所利用・郵便物受取・来客対応、会議室月4時間まで無料（超過分1時間1,100円）、法人登記オプション、同伴利用可（1日2時間まで）'
      : '場所貸しのみ、会議室利用可（1時間1,100円）'

  const formatTime = (time: string | null) => {
    if (!time) return ''
    return time.substring(0, 5) // "HH:MM"
  }

  // 平日/週末の時間帯を組み立てる
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

  // planTypeに応じた価格を取得
  const getPlanPrice = (plan: any) => {
    return planType === 'shared_office' ? plan.shared_office_price : plan.workspace_price
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/plans"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← プラン種類選択に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            {planTypeName}
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            {planTypeDescription}
          </p>
        </div>

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
            <p className="text-xs text-room-charcoal-light mt-2">
              データベースのマイグレーション（002_seed_plans.sql）を実行してください。
            </p>
          </div>
        )}

        {/* プラン一覧 */}
        {plans.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan?.plan_id === plan.id
              const price = getPlanPrice(plan)

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
                      ¥{price.toLocaleString()}/月
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-room-charcoal-light mb-4">
                    <p>
                      <strong>利用時間:</strong> {formatAvailableTime(plan)}
                    </p>
                    {planType === 'shared_office' && (
                      <>
                        <p>
                          <strong>住所利用:</strong> 可能（郵便物受取・来客対応含む）
                        </p>
                        <p>
                          <strong>会議室:</strong> 月4時間まで無料、超過分¥1,100/時間
                        </p>
                        <p>
                          <strong>プリンター:</strong> 標準装備
                        </p>
                      </>
                    )}
                    {planType === 'workspace' && (
                      <p>
                        <strong>会議室:</strong> ¥1,100/時間
                      </p>
                    )}
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
                      planPrice={price}
                      planType={planType}
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
