import { createClient } from '@/lib/supabase/server'

/**
 * 現在のユーザーが管理者かどうかをチェック
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('isAdmin: Auth error:', authError)
    return false
  }

  if (!user) {
    console.log('isAdmin: No authenticated user')
    return false
  }

  console.log('isAdmin: Checking user:', user.id, user.email)

  // RLSポリシーで自分の情報を読み取れるか確認
  // 注意: 自分の情報を読み取るには、005_add_users_policies.sql のポリシーが必要
  // 管理者ポリシー（013_add_admin_policies.sql）は、管理者が全ユーザー情報を読み取るためのもの
  // .maybeSingle()を使用して、結果が0件でもエラーにならないようにする
  const { data: userData, error } = await supabase
    .from('users')
    .select('is_admin, email, id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('isAdmin: Error fetching user data:', error)
    console.error('isAdmin: Error details:', JSON.stringify(error, null, 2))
    console.error('isAdmin: Error code:', error.code)
    console.error('isAdmin: Error message:', error.message)
    console.error('isAdmin: Error hint:', error.hint)
    return false
  }

  if (!userData) {
    console.log('isAdmin: User data not found in users table')
    console.log('isAdmin: This might mean the user record does not exist in the users table')
    return false
  }

  const isAdminResult = userData.is_admin === true
  console.log(`isAdmin: User ${userData.email} (id: ${userData.id}) is_admin=${userData.is_admin}, result=${isAdminResult}`)
  
  return isAdminResult
}

/**
 * 管理者権限をチェックし、管理者でない場合はリダイレクト
 */
export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    throw new Error('管理者権限が必要です')
  }
}

