import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'
import GroupCreateForm from './group-create-form'

export default async function AdminGroupNewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await isAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  // ユーザー一覧（オーナー選択用）
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('status', 'active')
    .order('name', { ascending: true })

  // プラン一覧（スロット設定用）
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code, workspace_price, shared_office_price')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/groups"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← グループ一覧に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            グループ新規作成
          </h1>
        </div>

        <GroupCreateForm users={users || []} plans={plans || []} />
      </div>
    </div>
  )
}
