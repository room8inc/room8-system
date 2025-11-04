'use client'

import Link from 'next/link'
import { ContractForm } from './contract-form'

interface PlanListProps {
  planType: 'shared_office' | 'coworking'
  plans: any[]
  currentPlan: any
  error: any
}

export function PlanList({ planType, plans, currentPlan, error }: PlanListProps) {
  const planTypeName =
    planType === 'shared_office' ? 'シェアオフィスプラン' : 'ワークスペースプラン（コワーキングスペースプラン）'
  const planTypeDescription =
    planType === 'shared_office'
      ? '住所利用可能、会議室月4時間まで無料（超過分1時間1,100円）、法人登記オプション、同伴利用可（1日2時間まで）'
      : '場所貸しのみ、会議室利用可（1時間1,100円）'

  const formatTime = (time: string) => {
    return time.substring(0, 5) // "HH:MM"
  }

  const formatDays = (days: string[]) => {
    const dayMap: { [key: string]: string } = {
      monday: '月',
      tuesday: '火',
      wednesday: '水',
      thursday: '木',
      friday: '金',
      saturday: '土',
      sunday: '日',
    }
    // ナイト&ホリデープランの場合、features.noteで詳細を表示
    if (days.length >= 7) {
      // 全曜日が含まれている場合は「全日」と表示
      return '全日'
    }
    return days.map((d) => dayMap[d] || d).join('・')
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
              const features = plan.features as any
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
                      ¥{plan.price.toLocaleString()}/月
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-room-charcoal-light mb-4">
                    {features?.note ? (
                      <>
                        <p>
                          <strong>利用時間:</strong> {features.note}
                        </p>
                        <p>
                          <strong>利用可能日:</strong> {formatDays(plan.available_days)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>利用時間:</strong> {formatTime(plan.start_time)} - {formatTime(plan.end_time)}
                        </p>
                        <p>
                          <strong>利用可能日:</strong> {formatDays(plan.available_days)}
                        </p>
                      </>
                    )}
                    {features?.meeting_room && (
                      <p>
                        <strong>会議室:</strong>{' '}
                        {features.meeting_room.free_hours
                          ? `月${features.meeting_room.free_hours}時間まで無料、超過分¥${features.meeting_room.rate}/時間`
                          : `¥${features.meeting_room.rate}/時間`}
                      </p>
                    )}
                    {features?.address_usage && (
                      <p>
                        <strong>住所利用:</strong> 可能
                      </p>
                    )}
                    {features?.company_registration && (
                      <p>
                        <strong>法人登記:</strong>{' '}
                        {features.company_registration.standard
                          ? '標準装備'
                          : `オプション（¥${features.company_registration.optional_price}/月）`}
                      </p>
                    )}
                    {features?.guest_usage && features.guest_usage.free_hours_per_guest && (
                      <p>
                        <strong>同伴利用:</strong> 可能（1日{features.guest_usage.free_hours_per_guest}時間まで無料）
                      </p>
                    )}
                    {features?.printer && (
                      <p>
                        <strong>プリンター:</strong> 標準装備
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
                    <ContractForm planId={plan.id} planName={plan.name} />
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

