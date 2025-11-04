'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatJapaneseName } from '@/lib/utils/name'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    nameKana: '',
    phone: '',
    address: '',
    companyName: '',
    isIndividual: true,
  })

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        setError(`ユーザー情報の取得に失敗しました: ${fetchError.message}`)
        return
      }

      if (userData) {
        // 既存のnameを「姓 名」の順にフォーマットしてから分割
        const formattedName = formatJapaneseName(userData.name || '')
        const nameParts = formattedName.trim().split(/\s+/)
        const lastName = nameParts.length >= 2 ? nameParts[0] : nameParts[0] || ''
        const firstName = nameParts.length >= 2 ? nameParts.slice(1).join(' ') : ''

        setFormData({
          lastName,
          firstName,
          nameKana: userData.name_kana || '',
          phone: userData.phone || '',
          address: userData.address || '',
          companyName: userData.company_name || '',
          isIndividual: userData.is_individual ?? true,
        })
      }
    } catch (err) {
      console.error('Error loading user data:', err)
      setError('ユーザー情報の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('ログインが必要です')
        router.push('/login')
        return
      }

      // 姓名を「姓 名」の順で結合
      const fullName = `${formData.lastName} ${formData.firstName}`.trim()

      const updateData: any = {
        name: fullName,
        name_kana: formData.nameKana || null,
        phone: formData.phone || null,
        address: formData.address || null,
        is_individual: formData.isIndividual,
      }

      // 法人の場合は会社名も更新
      if (!formData.isIndividual) {
        updateData.company_name = formData.companyName || null
      } else {
        updateData.company_name = null
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      if (updateError) {
        console.error('Update error:', updateError)
        setError(`プロフィールの更新に失敗しました: ${updateError.message}`)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    } catch (err) {
      console.error('Profile update error:', err)
      setError('プロフィールの更新中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-room-main hover:text-room-main-light"
            >
              ← ダッシュボードに戻る
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
              プロフィール編集
            </h1>
          </div>
        </div>

        {/* エラー・成功メッセージ */}
        {error && (
          <div className="mb-6 rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md bg-room-main bg-opacity-20 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">
              プロフィールを更新しました！
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 左カラム: 基本情報 */}
            <div className="space-y-6">
              {/* 会員区分 */}
              <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
                <h2 className="mb-4 text-lg font-semibold text-room-charcoal">
                  会員区分
                </h2>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="isIndividual"
                      checked={formData.isIndividual}
                      onChange={() => setFormData({ ...formData, isIndividual: true })}
                      className="mr-2"
                    />
                    個人
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="isIndividual"
                      checked={!formData.isIndividual}
                      onChange={() => setFormData({ ...formData, isIndividual: false })}
                      className="mr-2"
                    />
                    法人
                  </label>
                </div>
              </div>

              {/* 基本情報 */}
              <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
                <h2 className="mb-4 text-lg font-semibold text-room-charcoal">
                  基本情報
                </h2>
                <div className="space-y-4">
                  {/* 氏名（姓） */}
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-room-charcoal">
                      氏名（姓） <span className="text-room-main-dark">*</span>
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                    />
                  </div>

                  {/* 氏名（名） */}
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-room-charcoal">
                      氏名（名） <span className="text-room-main-dark">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
                      type="text"
                      value={formData.nameKana}
                      onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                    />
                  </div>
                </div>
              </div>

              {/* 法人情報（法人の場合のみ表示） */}
              {!formData.isIndividual && (
                <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
                  <h2 className="mb-4 text-lg font-semibold text-room-charcoal">
                    法人情報
                  </h2>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-room-charcoal">
                      会社名
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 右カラム: 連絡先情報 */}
            <div className="space-y-6">
              {/* 連絡先情報 */}
              <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
                <h2 className="mb-4 text-lg font-semibold text-room-charcoal">
                  連絡先情報
                </h2>
                <div className="space-y-4">
                  {/* 電話番号 */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-room-charcoal">
                      電話番号
                    </label>
                    <input
                      id="phone"
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
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="mt-8 flex justify-end gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-room-base-dark px-6 py-2 text-sm text-room-charcoal hover:bg-room-charcoal-light hover:text-white"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-room-main px-6 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

