'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    nameKana: '',
    phone: '',
    address: '',
    memberType: 'regular' as 'regular' | 'dropin',
    isIndividual: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // バリデーション
    if (formData.password !== formData.confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    if (formData.password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('Starting registration...')
      
      // Supabase Authでユーザー作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      console.log('SignUp result:', { authData, authError })

      if (authError) {
        console.error('Auth error:', authError)
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        console.error('No user data returned')
        setError('ユーザー作成に失敗しました')
        setLoading(false)
        return
      }

      // セッションが確立されるまで少し待つ（Supabase Authの仕様）
      // signUp後、自動的にセッションが確立されるが、少し時間がかかる場合がある
      await new Promise(resolve => setTimeout(resolve, 500))

      // 現在のセッションを確認
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session after signUp:', session)

      // usersテーブルに会員情報を登録
      console.log('Inserting user data...')
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          name_kana: formData.nameKana,
          phone: formData.phone,
          address: formData.address,
          member_type: formData.memberType,
          is_individual: formData.isIndividual,
          status: 'active',
        })
        .select()

      console.log('Insert result:', { insertData, insertError })

      if (insertError) {
        console.error('Insert error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        })
        setError(`会員情報の登録に失敗しました: ${insertError.message}${insertError.details ? ` (詳細: ${insertError.details})` : ''}`)
        setLoading(false)
        return
      }

      // 登録成功
      console.log('Registration successful!')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Registration error:', err)
      setError(`会員登録に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            新規会員登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            コワーキングスペース管理システム
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* 会員種別 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                会員種別
              </label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="memberType"
                    value="regular"
                    checked={formData.memberType === 'regular'}
                    onChange={(e) => setFormData({ ...formData, memberType: e.target.value as 'regular' | 'dropin' })}
                    className="mr-2"
                  />
                  定期会員
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="memberType"
                    value="dropin"
                    checked={formData.memberType === 'dropin'}
                    onChange={(e) => setFormData({ ...formData, memberType: e.target.value as 'regular' | 'dropin' })}
                    className="mr-2"
                  />
                  ドロップイン会員
                </label>
              </div>
            </div>

            {/* 個人/法人 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                会員区分
              </label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="isIndividual"
                    checked={formData.isIndividual}
                    onChange={(e) => setFormData({ ...formData, isIndividual: true })}
                    className="mr-2"
                  />
                  個人
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="isIndividual"
                    checked={!formData.isIndividual}
                    onChange={(e) => setFormData({ ...formData, isIndividual: false })}
                    className="mr-2"
                  />
                  法人
                </label>
              </div>
            </div>

            {/* メールアドレス */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* パスワード */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード（6文字以上）
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* パスワード確認 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* 氏名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                氏名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* フリガナ */}
            <div>
              <label htmlFor="nameKana" className="block text-sm font-medium text-gray-700">
                フリガナ
              </label>
              <input
                id="nameKana"
                name="nameKana"
                type="text"
                value={formData.nameKana}
                onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* 電話番号 */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                電話番号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* 住所 */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                住所
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? '登録中...' : '会員登録'}
            </button>
          </div>

          <div className="text-center">
            <a href="/login" className="text-sm text-blue-600 hover:text-blue-500">
              既にアカウントをお持ちの方はこちら
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}

