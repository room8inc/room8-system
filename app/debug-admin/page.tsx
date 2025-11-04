import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export default async function DebugAdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // ユーザー情報を直接取得
  let userData = null
  let userDataError = null
  if (user) {
    const result = await supabase
      .from('users')
      .select('id, email, is_admin, name, status')
      .eq('id', user.id)
      .maybeSingle()
    userData = result.data
    userDataError = result.error
  }

  const admin = await isAdmin()

  return (
    <div className="min-h-screen bg-room-base p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-room-charcoal">
          管理者権限デバッグページ
        </h1>

        <div className="space-y-6">
          {/* 認証情報 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="mb-4 text-xl font-semibold text-room-charcoal">
              認証情報
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">認証エラー:</span>{' '}
                {authError ? (
                  <span className="text-red-600">{JSON.stringify(authError)}</span>
                ) : (
                  <span className="text-green-600">なし</span>
                )}
              </div>
              <div>
                <span className="font-medium">ユーザーID:</span>{' '}
                {user?.id || <span className="text-red-600">なし</span>}
              </div>
              <div>
                <span className="font-medium">メールアドレス:</span>{' '}
                {user?.email || <span className="text-red-600">なし</span>}
              </div>
            </div>
          </div>

          {/* ユーザーデータ（直接取得） */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="mb-4 text-xl font-semibold text-room-charcoal">
              ユーザーデータ（直接取得）
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">取得エラー:</span>{' '}
                {userDataError ? (
                  <span className="text-red-600">
                    {JSON.stringify(userDataError, null, 2)}
                  </span>
                ) : (
                  <span className="text-green-600">なし</span>
                )}
              </div>
              <div>
                <span className="font-medium">ユーザーデータ:</span>
                <pre className="mt-2 overflow-auto rounded bg-room-base p-3 text-xs">
                  {JSON.stringify(userData, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-medium">is_admin:</span>{' '}
                {userData?.is_admin !== undefined ? (
                  <span className={userData.is_admin ? 'text-green-600' : 'text-red-600'}>
                    {userData.is_admin ? 'true' : 'false'}
                  </span>
                ) : (
                  <span className="text-red-600">未取得</span>
                )}
              </div>
            </div>
          </div>

          {/* isAdmin()関数の結果 */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="mb-4 text-xl font-semibold text-room-charcoal">
              isAdmin()関数の結果
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">結果:</span>{' '}
                <span className={admin ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                  {admin ? '管理者です' : '管理者ではありません'}
                </span>
              </div>
            </div>
          </div>

          {/* アクション */}
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="mb-4 text-xl font-semibold text-room-charcoal">
              アクション
            </h2>
            <div className="space-y-2">
              <a
                href="/admin"
                className="inline-block rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
              >
                管理者ページに移動
              </a>
              <a
                href="/dashboard"
                className="ml-2 inline-block rounded-md bg-room-charcoal px-4 py-2 text-sm text-white hover:bg-room-charcoal-light"
              >
                ダッシュボードに戻る
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

