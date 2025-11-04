import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ContractForm } from './contract-form'

export default async function PlansPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // プラン一覧を取得
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (plansError) {
    console.error('Plans fetch error:', plansError)
  }

  // 現在のプラン契約を取得
  const { data: currentPlan } = await supabase
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .single()

  // プランをシェアオフィスとワークスペースに分類
  const sharedOfficePlans = plans?.filter((plan) => {
    const features = plan.features as any
    return features?.type === 'shared_office'
  }) || []

  const coworkingPlans = plans?.filter((plan) => {
    const features = plan.features as any
    return features?.type === 'coworking'
  }) || []

  // デバッグ用：プランが取得できているか確認
  console.log('Plans fetched:', plans?.length || 0)
  console.log('Shared office plans:', sharedOfficePlans.length)
  console.log('Coworking plans:', coworkingPlans.length)

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
    return days.map((d) => dayMap[d] || d).join('・')
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
            プランを選択して会員契約を結びます
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
        {plansError && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              プラン情報の取得に失敗しました: {plansError.message}
            </p>
            <p className="text-xs text-room-charcoal-light mt-2">
              データベースのマイグレーション（002_seed_plans.sql）が実行されているか確認してください。
            </p>
          </div>
        )}

        {/* プランが取得できていない場合 */}
        {!plansError && (!plans || plans.length === 0) && (
          <div className="mb-8 rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6">
            <p className="text-sm text-room-wood-dark">
              プラン情報がありません
            </p>
            <p className="text-xs text-room-charcoal-light mt-2">
              データベースのマイグレーション（002_seed_plans.sql）を実行してください。
            </p>
          </div>
        )}

        {/* シェアオフィスプラン */}
        {sharedOfficePlans.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-room-charcoal mb-4">
              シェアオフィスプラン
            </h2>
            <p className="text-sm text-room-charcoal-light mb-4">
              住所利用可能、会議室月4時間まで無料
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sharedOfficePlans.map((plan) => {
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
                        <strong>会議室:</strong> 月{features.meeting_room.free_hours}時間まで無料
                      </p>
                    )}
                    {features?.address_usage && (
                      <p>
                        <strong>住所利用:</strong> 可能
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
          </div>
        )}

        {/* ワークスペースプラン（コワーキングスペースプラン） */}
        {coworkingPlans.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-room-charcoal mb-4">
              ワークスペースプラン（コワーキングスペースプラン）
            </h2>
            <p className="text-sm text-room-charcoal-light mb-4">
              場所貸しのみ、会議室利用可
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {coworkingPlans.map((plan) => {
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
                        <strong>会議室:</strong> ¥{features.meeting_room.rate}/時間
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
          </div>
        )}
      </div>
    </div>
  )
}

