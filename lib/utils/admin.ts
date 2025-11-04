import { createClient } from '@/lib/supabase/server'

/**
 * 現在のユーザーが管理者かどうかをチェック
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('isAdmin: No authenticated user')
    return false
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('is_admin, email')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('isAdmin: Error fetching user data:', error)
    return false
  }

  if (!userData) {
    console.log('isAdmin: User data not found')
    return false
  }

  const isAdminResult = userData.is_admin === true
  console.log(`isAdmin: User ${userData.email} is_admin=${userData.is_admin}, result=${isAdminResult}`)
  
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

