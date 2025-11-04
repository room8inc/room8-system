'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatJapaneseName } from '@/lib/utils/name'
import Link from 'next/link'

interface StaffMember {
  id: string
  name: string
  name_kana: string | null
  email: string | null
  phone: string | null
  status: string
  auth_user_id: string | null
  created_at: string
}

export default function StaffPage() {
  const router = useRouter()
  const supabase = createClient()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    nameKana: '',
    email: '',
    phone: '',
    password: '',
  })

  useEffect(() => {
    loadStaffMembers()
  }, [])

  const loadStaffMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 法人ユーザーか確認
      const { data: userData } = await supabase
        .from('users')
        .select('is_individual')
        .eq('id', user.id)
        .single()

      if (userData?.is_individual !== false) {
        setError('法人アカウントのみアクセス可能です')
        return
      }

      // スタッフ一覧を取得
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('company_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStaffMembers(data || [])
    } catch (err: any) {
      console.error('Error loading staff members:', err)
      setError(err.message || '利用者一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.email || !formData.password) {
      setError('メールアドレスとパスワードは必須です')
      return
    }

    if (formData.password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        setError('ログインが必要です')
        return
      }

      const fullName = `${formData.lastName} ${formData.firstName}`.trim()
      if (!fullName) {
        setError('氏名を入力してください')
        return
      }

      // 利用者用のアカウントを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: fullName,
            name_kana: formData.nameKana || null,
            phone: formData.phone || null,
            is_individual: true, // 利用者は個人として扱う
            is_staff: true, // 利用者フラグ
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('ユーザー作成に失敗しました')

      // トリガーが自動的にusersテーブルにINSERTするため、少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000))

      // usersテーブルを更新（is_staffフラグを設定）
      await supabase
        .from('users')
        .update({
          is_staff: true,
          name: fullName,
          name_kana: formData.nameKana || null,
          phone: formData.phone || null,
        })
        .eq('id', authData.user.id)

      // staff_membersテーブルにレコードを作成
      const { error: staffError } = await supabase
        .from('staff_members')
        .insert({
          company_user_id: currentUser.id,
          auth_user_id: authData.user.id,
          name: fullName,
          name_kana: formData.nameKana || null,
          email: formData.email,
          phone: formData.phone || null,
          status: 'active',
        })

      if (staffError) throw staffError

      // フォームをリセット
      setFormData({
        lastName: '',
        firstName: '',
        nameKana: '',
        email: '',
        phone: '',
        password: '',
      })
      setShowAddForm(false)
      await loadStaffMembers()
    } catch (err: any) {
      console.error('Error adding staff:', err)
      setError(err.message || '利用者の追加に失敗しました')
    }
  }

  const handleDeleteStaff = async (staffId: string, authUserId: string | null) => {
    if (!confirm('この利用者を削除しますか？')) return

    try {
      // staff_membersテーブルから削除
      const { error } = await supabase
        .from('staff_members')
        .delete()
        .eq('id', staffId)

      if (error) throw error

      // auth.usersからも削除（必要に応じて）
      // 注意: 通常はauth.usersの削除は管理者権限が必要なため、ここではstaff_membersのみ削除
      // 必要に応じて、admin API経由で削除する

      await loadStaffMembers()
    } catch (err: any) {
      console.error('Error deleting staff:', err)
      setError(err.message || '利用者の削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/member-card"
            className="inline-flex items-center text-sm text-room-main hover:text-room-main-light mb-4"
          >
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            会員証に戻る
          </Link>
          <h1 className="text-3xl font-bold text-room-charcoal">利用者管理</h1>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-room-error-light p-4 text-room-error border border-room-error">
            {error}
          </div>
        )}

        {/* 利用者追加ボタン */}
        {!showAddForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light"
            >
              + 利用者を追加
            </button>
          </div>
        )}

        {/* 利用者追加フォーム */}
        {showAddForm && (
          <div className="mb-8 rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="mb-4 text-lg font-semibold text-room-charcoal">利用者を追加</h2>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-room-charcoal mb-1">
                    姓 <span className="text-room-main-dark">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-room-charcoal mb-1">
                    名 <span className="text-room-main-dark">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-1">
                  フリガナ
                </label>
                <input
                  type="text"
                  value={formData.nameKana}
                  onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                  className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-1">
                  メールアドレス <span className="text-room-main-dark">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-1">
                  電話番号
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-room-charcoal mb-1">
                  パスワード（6文字以上） <span className="text-room-main-dark">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light"
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setFormData({
                      lastName: '',
                      firstName: '',
                      nameKana: '',
                      email: '',
                      phone: '',
                      password: '',
                    })
                  }}
                  className="rounded-md bg-room-base-dark px-4 py-2 text-room-charcoal hover:bg-room-base-dark-light"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 利用者一覧 */}
        <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark">
          <div className="px-6 py-4 border-b border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal">利用者一覧</h2>
          </div>
          {staffMembers.length === 0 ? (
            <div className="p-6 text-center text-room-charcoal-light">
              利用者が登録されていません
            </div>
          ) : (
            <div className="divide-y divide-room-base-dark">
              {staffMembers.map((staff) => (
                <div key={staff.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-room-charcoal">
                        {formatJapaneseName(staff.name)}
                      </h3>
                      {staff.name_kana && (
                        <p className="text-sm text-room-charcoal-light">{staff.name_kana}</p>
                      )}
                      {staff.email && (
                        <p className="text-sm text-room-charcoal-light">{staff.email}</p>
                      )}
                      {staff.phone && (
                        <p className="text-sm text-room-charcoal-light">{staff.phone}</p>
                      )}
                      <p className="text-xs text-room-charcoal-light mt-2">
                        ステータス: {staff.status === 'active' ? 'アクティブ' : '非アクティブ'}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => handleDeleteStaff(staff.id, staff.auth_user_id)}
                        className="rounded-md bg-room-error-light px-3 py-1 text-sm text-room-error hover:bg-room-error-light-light"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

