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
      
      // Supabase Authでユーザー作成（user_metadataに追加情報を含める）
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            name_kana: formData.nameKana,
            phone: formData.phone,
            address: formData.address,
            member_type: formData.memberType,
            is_individual: formData.isIndividual,
          }
        }
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

      // トリガーが自動的にusersテーブルにINSERTするため、少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000))

      // セッションを確認
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session after signUp:', session)

      // トリガーで自動的にusersテーブルにINSERTされるが、
      // 空の値でINSERTされる可能性があるため、UPDATEで詳細情報を反映
      if (session) {
        console.log('Updating user data...')
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({
            name: formData.name,
            name_kana: formData.nameKana,
            phone: formData.phone,
            address: formData.address,
            member_type: formData.memberType,
            is_individual: formData.isIndividual,
            status: 'active',
          })
          .eq('id', authData.user.id)
          .select()

        console.log('Update result:', { updateData, updateError })

        if (updateError) {
          console.error('Update error details:', {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
          })
          // エラーがあっても、ユーザーは作成されているので続行
        }
      } else {
        // セッションが確立されていない場合（メール確認が必要な場合など）
        // 手動でusersテーブルにINSERTを試みる（Service Role Keyが必要）
        console.warn('Session not established, user data may need manual update')
      }

      // 登録成功
      console.log('Registration successful!')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Registration error:', err)
      setError(`アカウント作成に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-room-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8 rounded-lg bg-room-base-light p-8 shadow-md border border-room-base-dark">
        <div>
          <h2 className="text-center text-3xl font-bold text-room-charcoal">
            アカウント作成
          </h2>
          <p className="mt-2 text-center text-sm text-room-charcoal-light">
            コワーキングスペース管理システム
          </p>
          <p className="mt-2 text-center text-xs text-room-charcoal-light">
            アカウント作成後、Room8会員契約を結ぶか、ドロップイン（非会員）として利用できます
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* 利用形態 */}
            <div>
              <label className="block text-sm font-medium text-room-charcoal">
                利用形態の希望
              </label>
              <p className="mt-1 mb-3 text-xs text-room-charcoal-light">
                アカウント作成時点ではまだRoom8会員ではありません。後で会員契約を結ぶか、ドロップイン（非会員）として利用するかを選択してください
              </p>
              <div className="mt-2 space-y-3">
                <label className="flex items-start p-3 rounded-md border border-room-base-dark bg-room-base hover:bg-room-base-dark cursor-pointer">
                  <input
                    type="radio"
                    name="memberType"
                    value="regular"
                    checked={formData.memberType === 'regular'}
                    onChange={(e) => setFormData({ ...formData, memberType: e.target.value as 'regular' | 'dropin' })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className="font-medium text-room-charcoal">Room8会員契約を希望</span>
                    <p className="text-xs text-room-charcoal-light mt-1">
                      後で定額プランに加入し、月額料金で利用します（会員契約は別途必要です）
                    </p>
                  </div>
                </label>
                <label className="flex items-start p-3 rounded-md border border-room-base-dark bg-room-base hover:bg-room-base-dark cursor-pointer">
                  <input
                    type="radio"
                    name="memberType"
                    value="dropin"
                    checked={formData.memberType === 'dropin'}
                    onChange={(e) => setFormData({ ...formData, memberType: e.target.value as 'regular' | 'dropin' })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <span className="font-medium text-room-charcoal">ドロップイン（非会員）として利用</span>
                    <p className="text-xs text-room-charcoal-light mt-1">
                      会員契約は不要。利用時に1時間400円でご利用いただけます
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 個人/法人 */}
            <div>
              <label className="block text-sm font-medium text-room-charcoal">
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
              <label htmlFor="email" className="block text-sm font-medium text-room-charcoal">
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
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {/* パスワード */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-room-charcoal">
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
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {/* パスワード確認 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-room-charcoal">
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
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {/* 氏名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-room-charcoal">
                氏名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {/* フリガナ */}
            <div>
              <label htmlFor="nameKana" className="block text-sm font-medium text-room-charcoal">
                フリガナ
              </label>
              <input
                id="nameKana"
                name="nameKana"
                type="text"
                value={formData.nameKana}
                onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {/* 電話番号 */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-room-charcoal">
                電話番号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>

            {/* 住所 */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-room-charcoal">
                住所
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? '作成中...' : 'アカウント作成'}
            </button>
          </div>

          <div className="text-center">
            <a href="/login" className="text-sm text-room-main hover:text-room-main-light">
              既にアカウントをお持ちの方はこちら
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}

