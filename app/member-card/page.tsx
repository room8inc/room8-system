import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/app/dashboard/logout-button'
import { formatJapaneseName } from '@/lib/utils/name'

export default async function MemberCardPage() {
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
    .select('*')
    .eq('id', user.id)
    .single()

  // 現在のプラン情報を取得（定期会員の場合）
  const { data: currentPlan } = await supabase
    .from('user_plans')
    .select('*, plans(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('ended_at', null)
    .single()

  // 会員番号を生成（ユーザーIDの最初の8文字を使用）
  const memberNumber = user.id.substring(0, 8).toUpperCase()

  // 利用形態の表示名
  // member_typeはプラン契約時に設定される
  // - プラン契約あり = member_type='regular' = Room8会員
  // - プラン契約なし = member_type='dropin'（デフォルト） = ドロップイン（非会員）
  const memberTypeDisplay =
    currentPlan || userData?.member_type === 'regular'
      ? 'Room8会員'
      : 'ドロップイン（非会員）'

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-room-charcoal">会員証</h1>
        </div>

        {/* 会員証カード */}
        <div className="mb-8 rounded-xl bg-gradient-to-br from-room-main to-room-main-dark p-8 shadow-xl border-2 border-room-wood">
          <div className="flex flex-col items-center text-center text-white">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white bg-opacity-20 text-3xl font-bold border-2 border-room-brass">
              {formatJapaneseName(userData?.name)?.charAt(0) || user.email?.charAt(0) || '?'}
            </div>
            <h2 className="mb-2 text-2xl font-bold">
              {formatJapaneseName(userData?.name) || user.email}
            </h2>
            {currentPlan && (
              <p className="mb-1 text-lg font-medium text-room-base-light">
                {currentPlan.plans?.name || 'プラン名不明'}
              </p>
            )}
            <p className="mb-4 text-sm text-room-base-light">{memberTypeDisplay}</p>
            <div className="rounded-lg bg-room-wood bg-opacity-30 px-4 py-2 border border-room-brass">
              <p className="text-xs text-room-base-light">会員番号</p>
              <p className="text-lg font-mono font-bold text-room-brass">{memberNumber}</p>
            </div>
          </div>
        </div>

        {/* メニューリスト */}
        <div className="space-y-3">
          {/* 会員情報 */}
          <Link
            href="/profile"
            className="block rounded-lg bg-room-base-light p-6 shadow transition-shadow hover:shadow-md border border-room-base-dark"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-main bg-opacity-10">
                  <svg
                    className="h-6 w-6 text-room-main"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-room-charcoal">会員情報</h3>
                  <p className="text-sm text-room-charcoal-light">プロフィール編集</p>
                </div>
              </div>
              <svg
                className="h-5 w-5 text-room-wood"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* パスワード変更 */}
          <div className="block rounded-lg bg-room-base-light p-6 shadow opacity-60 border border-room-base-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-base-dark">
                  <svg
                    className="h-6 w-6 text-room-charcoal-light"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-room-charcoal">パスワード変更</h3>
                  <p className="text-sm text-room-charcoal-light">Phase 2で実装予定</p>
                </div>
              </div>
            </div>
          </div>

          {/* 決済履歴・領収書 */}
          <div className="block rounded-lg bg-room-base-light p-6 shadow opacity-60 border border-room-base-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-base-dark">
                  <svg
                    className="h-6 w-6 text-room-charcoal-light"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-room-charcoal">決済履歴・領収書</h3>
                  <p className="text-sm text-room-charcoal-light">Phase 2で実装予定</p>
                </div>
              </div>
            </div>
          </div>

          {/* 会員契約 */}
          <div className="block rounded-lg bg-room-base-light p-6 shadow opacity-60 border border-room-base-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-base-dark">
                  <svg
                    className="h-6 w-6 text-room-charcoal-light"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-room-charcoal">会員契約</h3>
                  <p className="text-sm text-room-charcoal-light">プラン情報、契約期間、変更履歴（Phase 4で実装予定）</p>
                </div>
              </div>
            </div>
          </div>

          {/* 支払方法 */}
          <div className="block rounded-lg bg-room-base-light p-6 shadow opacity-60 border border-room-base-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-room-base-dark">
                  <svg
                    className="h-6 w-6 text-room-charcoal-light"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-room-charcoal">支払方法</h3>
                  <p className="text-sm text-room-charcoal-light">クレジットカード変更（Phase 2で実装予定）</p>
                </div>
              </div>
            </div>
          </div>

          {/* ログアウト */}
          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  )
}

