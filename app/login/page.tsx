'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/utils/auth-error'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // パスワード再発行用の状態
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(translateAuthError(authError))
        setLoading(false)
        return
      }

      if (data.user) {
        // ログイン成功
        // セッションは自動的に30日間保持される（rememberMeの設定に応じて）
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(translateAuthError(err))
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)

    try {
      // パスワードリセットメールを送信
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        setResetError(translateAuthError(resetError))
        setResetLoading(false)
        return
      }

      // 成功
      setResetSuccess(true)
      setResetLoading(false)
    } catch (err) {
      setResetError(translateAuthError(err))
      setResetLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-room-base">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-room-base-light p-8 shadow-md border border-room-base-dark">
        <div>
          <h2 className="text-center text-3xl font-bold text-room-charcoal">
            Room8 ログイン
          </h2>
          <p className="mt-2 text-center text-sm text-room-charcoal-light">
            コワーキングスペース管理システム
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}

          <div className="space-y-4">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-room-charcoal">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                placeholder="パスワード"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-room-base-dark text-room-main focus:ring-room-main"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-room-charcoal">
              ログイン状態を保持（30日間）
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="text-sm text-room-main hover:text-room-main-light underline"
            >
              パスワードを忘れた方
            </button>
            <div>
              <a href="/register" className="text-sm text-room-main hover:text-room-main-light">
                アカウント作成はこちら
              </a>
            </div>
          </div>
        </form>
      </div>

      {/* パスワード再発行モーダル */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-room-base-light p-8 shadow-md border border-room-base-dark">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-room-charcoal">
                パスワード再発行
              </h3>
              <p className="mt-2 text-sm text-room-charcoal-light">
                登録されているメールアドレスを入力してください。
                パスワード再設定用のリンクを送信します。
              </p>
            </div>

            {resetSuccess ? (
              <div className="space-y-4">
                <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
                  <p className="text-sm text-room-main-dark">
                    パスワード再設定用のメールを送信しました。
                    <br />
                    メール内のリンクから新しいパスワードを設定してください。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowResetModal(false)
                    setResetSuccess(false)
                    setResetEmail('')
                  }}
                  className="w-full rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {resetError && (
                  <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
                    <p className="text-sm text-room-main-dark">{resetError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-room-charcoal">
                    メールアドレス
                  </label>
                  <input
                    id="reset-email"
                    name="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false)
                      setResetEmail('')
                      setResetError(null)
                    }}
                    className="flex-1 rounded-md border border-room-base-dark bg-room-base px-4 py-2 text-room-charcoal hover:bg-room-base-dark focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
                  >
                    {resetLoading ? '送信中...' : '送信'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

