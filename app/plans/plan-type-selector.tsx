'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface PlanTypeSelectorProps {
  plans: any[]
  currentPlan: any
  error: any
}

export function PlanTypeSelector({
  plans,
  currentPlan,
  error,
}: PlanTypeSelectorProps) {
  const router = useRouter()

  // 最低価格を算出
  const minWorkspacePrice = plans.length > 0
    ? Math.min(...plans.filter(p => p.workspace_price != null).map(p => p.workspace_price))
    : 0
  const minSharedOfficePrice = plans.length > 0
    ? Math.min(...plans.filter(p => p.shared_office_price != null).map(p => p.shared_office_price))
    : 0

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
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
            まず、ご希望のプラン種類を選択してください
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
            <p className="text-xs text-room-charcoal-light mt-2">
              データベースのマイグレーション（002_seed_plans.sql）が実行されているか確認してください。
            </p>
          </div>
        )}

        {/* プラン種類選択カード */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ワークスペースプラン */}
          <button
            onClick={() => router.push('/plans?type=workspace')}
            className="group rounded-lg border-2 border-room-base-dark bg-room-base-light p-8 text-left transition-all hover:border-room-main hover:shadow-lg"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-room-charcoal mb-2">
                ワークスペースプラン
              </h2>
              <p className="text-sm text-room-charcoal-light">
                {minWorkspacePrice > 0 && (
                  <>¥{minWorkspacePrice.toLocaleString()}〜/月</>
                )}
              </p>
            </div>
            <div className="space-y-2 text-sm text-room-charcoal-light">
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>場所貸しのみ（シンプルな利用）</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>会議室利用可（1時間1,100円）</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>低価格から始められる</span>
              </p>
            </div>
            <div className="mt-6 flex items-center text-room-main group-hover:text-room-main-light">
              <span className="text-sm font-medium">プランを選択する</span>
              <svg
                className="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>

          {/* シェアオフィスプラン */}
          <button
            onClick={() => router.push('/plans?type=shared_office')}
            className="group rounded-lg border-2 border-room-base-dark bg-room-base-light p-8 text-left transition-all hover:border-room-main hover:shadow-lg"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-room-charcoal mb-2">
                シェアオフィスプラン
              </h2>
              <p className="text-sm text-room-charcoal-light">
                {minSharedOfficePrice > 0 && (
                  <>¥{minSharedOfficePrice.toLocaleString()}〜/月</>
                )}
              </p>
            </div>
            <div className="space-y-2 text-sm text-room-charcoal-light">
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>住所利用・郵便物受取・来客対応</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>会議室月4時間まで無料（超過分1時間1,100円）</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>同伴利用可（1日2時間まで）</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-room-main">✓</span>
                <span>プリンター標準装備</span>
              </p>
            </div>
            <div className="mt-6 flex items-center text-room-main group-hover:text-room-main-light">
              <span className="text-sm font-medium">プランを選択する</span>
              <svg
                className="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
