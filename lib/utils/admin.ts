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
    return false
  }

  const { data: userData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return userData?.is_admin === true
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

