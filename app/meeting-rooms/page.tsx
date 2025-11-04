import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MeetingRoomsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ユーザー情報を取得
  const { data: userData } = await supabase
    .from('users')
    .select('member_type')
    .eq('id', user.id)
    .single()

  // 現在のプラン情報を取得
  const { data: currentPlan } = await supabase
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .single()

  // 料金を計算
  const calculateRate = () => {
    if (userData?.member_type !== 'regular') {
      // 定額会員以外：1時間2,200円
      return 2200
    }

    if (currentPlan?.plans) {
      // シェアオフィスプランのチェック（features.type === 'shared_office'）
      const features = currentPlan.plans.features as any
      if (features?.type === 'shared_office') {
        // シェアオフィスプラン：月4時間まで無料、超過分1,100円/時間
        // 実際の無料枠の使用状況は後で実装（Phase 2）
        return {
          rate: 1100,
          freeHours: 4,
          note: '月4時間まで無料',
        }
      }
    }

    // 定額会員（一般）：1時間1,100円
    return 1100
  }

  const rateInfo = calculateRate()

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
            会議室予約
          </h1>
        </div>

        {/* 会議室情報カード */}
        <div className="mb-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-room-charcoal mb-2">
                会議室
              </h2>
              <p className="text-sm text-room-charcoal-light">
                1室のみの会議室をご利用いただけます
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-room-charcoal-light mb-1">料金</p>
              {typeof rateInfo === 'number' ? (
                <p className="text-lg font-bold text-room-main">
                  ¥{rateInfo.toLocaleString()}/時間
                </p>
              ) : (
                <div>
                  <p className="text-lg font-bold text-room-main">
                    ¥{rateInfo.rate.toLocaleString()}/時間
                  </p>
                  <p className="text-xs text-room-charcoal-light mt-1">
                    {rateInfo.note}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 予約機能（Phase 2で実装予定） */}
        <div className="rounded-lg bg-room-base-light p-8 shadow border border-room-base-dark">
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-16 w-16 text-room-charcoal-light"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-room-charcoal mb-2">
              予約機能は準備中です
            </h3>
            <p className="text-sm text-room-charcoal-light mb-4">
              会議室の予約機能はPhase 2で実装予定です。
              <br />
              現在は予約情報の確認のみ可能です。
            </p>
            <div className="rounded-md bg-room-main bg-opacity-10 p-4 border border-room-main">
              <p className="text-sm text-room-charcoal mb-2">
                <strong>予定されている機能：</strong>
              </p>
              <ul className="text-sm text-room-charcoal-light text-left space-y-1 max-w-md mx-auto">
                <li>• 空き状況の確認</li>
                <li>• 日時・時間の選択</li>
                <li>• 予約の作成・変更・キャンセル</li>
                <li>• 複数人利用時の請求分け機能</li>
                <li>• 予約確認メール送信</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 料金体系の説明 */}
        <div className="mt-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h3 className="text-lg font-semibold text-room-charcoal mb-4">
            料金体系
          </h3>
          <div className="space-y-4">
            <div className="border-l-4 border-room-main pl-4">
              <p className="font-medium text-room-charcoal">
                定額会員（シェアオフィスプラン）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                月4時間まで無料、超過分：¥1,100/時間
              </p>
            </div>
            <div className="border-l-4 border-room-wood pl-4">
              <p className="font-medium text-room-charcoal">
                定額会員（一般）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                ¥1,100/時間
              </p>
            </div>
            <div className="border-l-4 border-room-brass pl-4">
              <p className="font-medium text-room-charcoal">
                定額会員以外（ドロップイン会員など）
              </p>
              <p className="text-sm text-room-charcoal-light mt-1">
                ¥2,200/時間
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-room-base-dark">
            <p className="text-xs text-room-charcoal-light">
              <strong>決済タイミング：</strong>
              <br />
              定額会員：時間外利用と合算して月末（翌月1日）にまとめて請求
              <br />
              ドロップイン会員：予約時に決済
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

