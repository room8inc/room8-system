import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import { formatJapaneseName } from '@/lib/utils/name'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 管理者権限チェック
  // デバッグ: ユーザー情報を直接取得して確認
  const { data: currentUserData, error: currentUserError } = await supabase
    .from('users')
    .select('is_admin, email, id')
    .eq('id', user.id)
    .maybeSingle()

  console.log('Admin page: Current user data:', {
    userId: user.id,
    email: user.email,
    userData: currentUserData,
    error: currentUserError,
  })

  const admin = await isAdmin()
  console.log('Admin page: isAdmin() result:', admin)
  
  if (!admin) {
    console.log('Admin page: Not admin, redirecting to dashboard')
    console.log('Admin page: User is_admin value:', currentUserData?.is_admin)
    console.log('Admin page: User email:', currentUserData?.email)
    // デバッグ用: エラーを表示してからリダイレクト
    if (currentUserError) {
      console.error('Admin page: Error fetching user data:', currentUserError)
    }
    redirect('/dashboard')
  }
  
  console.log('Admin page: Admin access granted')

  // ユーザー一覧を取得
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  // 各ユーザーの現在のプラン契約を取得
  const usersWithPlans = await Promise.all(
    (users || []).map(async (userItem) => {
      const { data: currentPlan } = await supabase
        .from('user_plans')
        .select('*, plans(*)')
        .eq('user_id', userItem.id)
        .eq('status', 'active')
        .is('ended_at', null)
        .single()

      return {
        ...userItem,
        currentPlan,
      }
    })
  )

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
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-room-charcoal">
                管理者画面 - ユーザー管理
              </h1>
              <p className="mt-2 text-sm text-room-charcoal-light">
                ユーザーのプラン変更・削除ができます
              </p>
            </div>
            <Link
              href="/admin/campaigns"
              className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
            >
              キャンペーン管理
            </Link>
            <Link
              href="/admin/google-calendar"
              className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
            >
              Googleカレンダー連携
            </Link>
          </div>
        </div>

        {/* エラー表示 */}
        {usersError && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              ユーザー情報の取得に失敗しました: {usersError.message}
            </p>
          </div>
        )}

        {/* ユーザー一覧テーブル */}
        <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-room-base-dark">
              <thead className="bg-room-base-dark">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    ユーザー名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    メールアドレス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    会員種別
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    現在のプラン
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    登録日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-room-base-light divide-y divide-room-base-dark">
                {usersWithPlans.map((userItem) => {
                  const memberTypeDisplay =
                    userItem.currentPlan || userItem.member_type === 'regular'
                      ? 'Room8会員'
                      : 'ドロップイン（非会員）'

                  return (
                    <tr key={userItem.id} className="hover:bg-room-base">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-room-charcoal">
                          {formatJapaneseName(userItem.name)}
                        </div>
                        {userItem.is_admin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-room-main text-white mt-1">
                            管理者
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-room-charcoal-light">
                          {userItem.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-room-charcoal-light">
                          {memberTypeDisplay}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-room-charcoal-light">
                          {userItem.currentPlan
                            ? userItem.currentPlan.plans?.name || 'プラン名不明'
                            : 'プラン未契約'}
                        </div>
                        {userItem.currentPlan && (
                          <div className="text-xs text-room-charcoal-light">
                            契約開始: {new Date(userItem.currentPlan.started_at).toLocaleDateString('ja-JP')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-room-charcoal-light">
                          {new Date(userItem.created_at).toLocaleDateString('ja-JP')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/admin/users/${userItem.id}`}
                          className="text-room-main hover:text-room-main-light"
                        >
                          詳細・編集
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ユーザー数が0の場合 */}
        {usersWithPlans.length === 0 && (
          <div className="rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center">
            <p className="text-sm text-room-wood-dark">
              ユーザーが登録されていません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

