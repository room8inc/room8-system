'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/utils/auth-error'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Supabaseがハッシュフラグメントからトークンを処理するのを待つ
    const initialize = async () => {
      // ハッシュフラグメントを確認
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')

      // ハッシュフラグメントがある場合、Supabaseクライアントが自動的に処理するのを待つ
      if (accessToken && type === 'recovery') {
        // Supabaseがハッシュフラグメントを処理する時間を与える
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      setIsInitialized(true)
    }

    initialize()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // バリデーション
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)

    try {
      // パスワードを更新
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(translateAuthError(updateError))
        setLoading(false)
        return
      }

      // 成功
      setSuccess(true)
      setLoading(false)

      // 3秒後にダッシュボードにリダイレクト
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (err) {
      setError(translateAuthError(err))
      setLoading(false)
    }
  }

  // 初期化中はローディング表示
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-room-base">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-room-base-light p-8 shadow-md border border-room-base-dark">
          <div className="text-center">
            <p className="text-room-charcoal">読み込み中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-room-base">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-room-base-light p-8 shadow-md border border-room-base-dark">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-room-main bg-opacity-10">
              <svg
                className="h-6 w-6 text-room-main"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-room-charcoal">
              パスワードを変更しました
            </h2>
            <p className="mt-2 text-sm text-room-charcoal-light">
              新しいパスワードでログインできます。
              <br />
              ダッシュボードに移動します...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-room-base">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-room-base-light p-8 shadow-md border border-room-base-dark">
        <div>
          <h2 className="text-center text-3xl font-bold text-room-charcoal">
            パスワード再設定
          </h2>
          <p className="mt-2 text-center text-sm text-room-charcoal-light">
            新しいパスワードを入力してください
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-room-charcoal">
                新しいパスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                placeholder="6文字以上"
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-room-charcoal">
                パスワード（確認）
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                placeholder="同じパスワードを入力"
                minLength={6}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? '変更中...' : 'パスワードを変更'}
            </button>
          </div>

          <div className="text-center">
            <Link href="/login" className="text-sm text-room-main hover:text-room-main-light">
              ログインページに戻る
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

