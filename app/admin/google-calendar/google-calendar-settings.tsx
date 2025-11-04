'use client'

import { useState, useEffect } from 'react'

interface ConnectionStatus {
  connected: boolean
  error?: string
  message?: string
  calendarId?: string
  missing?: {
    serviceAccountEmail?: boolean
    privateKey?: boolean
    calendarId?: boolean
  }
}

interface Calendar {
  id: string
  name: string
  description?: string
  accessRole?: string
}

interface Settings {
  id: string
  calendar_id: string
  calendar_name: string
  is_active: boolean
}

interface OAuthStatus {
  connected: boolean
  email?: string
  expiresAt?: string
}

export function GoogleCalendarSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [currentSettings, setCurrentSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null)
  const [loadingOAuth, setLoadingOAuth] = useState(false)

  useEffect(() => {
    checkConnection()
    loadCurrentSettings()
    loadCalendars()
    loadOAuthStatus()

    // URLパラメータからsuccess/errorを取得して表示
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')
    
    if (success) {
      alert(success)
      // URLからパラメータを削除
      window.history.replaceState({}, '', window.location.pathname)
      // OAuthステータスを再読み込み
      loadOAuthStatus()
      checkConnection()
    }
    
    if (error) {
      alert(`エラー: ${error}`)
      // URLからパラメータを削除
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const loadOAuthStatus = async () => {
    try {
      const response = await fetch('/api/admin/google-calendar/oauth/status')
      const data = await response.json()
      if (data.connected !== undefined) {
        setOAuthStatus(data)
      }
    } catch (error: any) {
      console.error('Failed to load OAuth status:', error)
    }
  }

  const connectOAuth = async () => {
    setLoadingOAuth(true)
    try {
      const response = await fetch('/api/admin/google-calendar/oauth/auth')
      const data = await response.json()
      if (data.authUrl) {
        // OAuth認証URLにリダイレクト
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error || '認証URLの取得に失敗しました')
      }
    } catch (error: any) {
      alert(`OAuth認証の開始に失敗しました: ${error.message}`)
      setLoadingOAuth(false)
    }
  }

  const loadCurrentSettings = async () => {
    try {
      const response = await fetch('/api/admin/google-calendar/settings')
      const data = await response.json()
      if (data.settings) {
        setCurrentSettings(data.settings)
        setSelectedCalendarId(data.settings.calendar_id)
      }
    } catch (error: any) {
      console.error('Failed to load current settings:', error)
    }
  }

  const loadCalendars = async () => {
    setLoadingCalendars(true)
    try {
      const response = await fetch('/api/admin/google-calendar/list')
      const data = await response.json()
      if (data.calendars) {
        setCalendars(data.calendars)
      } else if (data.error) {
        console.error('Failed to load calendars:', data.error)
      }
    } catch (error: any) {
      console.error('Failed to load calendars:', error)
    } finally {
      setLoadingCalendars(false)
    }
  }

  const checkConnection = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/google-calendar/test-connection')
      const data = await response.json()
      setStatus(data)
    } catch (error: any) {
      setStatus({
        connected: false,
        error: `接続テストに失敗しました: ${error.message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/admin/google-calendar/test-connection')
      const data = await response.json()
      setStatus(data)
      if (data.connected) {
        alert('Googleカレンダーへの接続に成功しました！')
      } else {
        alert(`接続に失敗しました: ${data.error || '不明なエラー'}`)
      }
    } catch (error: any) {
      setStatus({
        connected: false,
        error: `接続テストに失敗しました: ${error.message}`,
      })
      alert(`接続テストに失敗しました: ${error.message}`)
    } finally {
      setTesting(false)
    }
  }

  const saveCalendarSelection = async () => {
    if (!selectedCalendarId) {
      alert('カレンダーを選択してください')
      return
    }

    setSaving(true)
    try {
      const selectedCalendar = calendars.find((cal) => cal.id === selectedCalendarId)
      const response = await fetch('/api/admin/google-calendar/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: selectedCalendarId,
          calendarName: selectedCalendar?.name || selectedCalendarId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '設定の保存に失敗しました')
      }

      alert('カレンダー設定を保存しました！')
      await loadCurrentSettings()
      await checkConnection() // 接続状況を再確認
    } catch (error: any) {
      alert(`設定の保存に失敗しました: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-room-charcoal">Googleカレンダー連携</h2>
          <p className="text-sm text-room-charcoal-light mt-1">
            Googleカレンダーとの連携状況を確認・テストできます
          </p>
        </div>
        <button
          onClick={testConnection}
          disabled={testing}
          className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? 'テスト中...' : '接続テスト'}
        </button>
      </div>

      {loading && !status && (
        <div className="rounded-md bg-room-base-dark p-4">
          <p className="text-sm text-room-charcoal-light">接続状況を確認中...</p>
        </div>
      )}

      {status && (
        <div className="space-y-4">
          {/* 接続状況 */}
          <div
            className={`rounded-md p-4 border ${
              status.connected
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${
                  status.connected ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {status.connected ? '✓ 接続済み' : '✗ 未接続'}
              </span>
            </div>
            {status.message && (
              <p className={`text-sm mt-1 ${status.connected ? 'text-green-700' : 'text-red-700'}`}>
                {status.message}
              </p>
            )}
            {status.error && (
              <p className="text-sm mt-1 text-red-700">{status.error}</p>
            )}
            {status.calendarId && (
              <p className="text-xs mt-1 text-room-charcoal-light">
                カレンダーID: {status.calendarId}
              </p>
            )}
          </div>

          {/* 環境変数の設定状況 */}
          {status.missing && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm font-medium text-room-main-dark mb-2">
                未設定の環境変数:
              </p>
              <ul className="text-sm text-room-main-dark space-y-1">
                {status.missing.serviceAccountEmail && (
                  <li>• GOOGLE_SERVICE_ACCOUNT_EMAIL</li>
                )}
                {status.missing.privateKey && <li>• GOOGLE_PRIVATE_KEY</li>}
                {status.missing.calendarId && <li>• GOOGLE_CALENDAR_ID</li>}
              </ul>
              <p className="text-xs text-room-charcoal-light mt-2">
                環境変数はVercel DashboardのSettings &gt; Environment Variablesから設定してください。
                <br />
                詳細は <code className="bg-room-base-dark px-1 rounded">ENV_VARIABLES.md</code> を参照してください。
              </p>
            </div>
          )}

          {/* カレンダー選択 */}
          {status.connected && (
            <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-room-wood-dark">
                  使用するカレンダーを選択
                </h3>
                <button
                  onClick={loadCalendars}
                  disabled={loadingCalendars}
                  className="text-xs text-room-main hover:text-room-main-light disabled:opacity-50"
                >
                  {loadingCalendars ? '読み込み中...' : '再読み込み'}
                </button>
              </div>

              {loadingCalendars ? (
                <p className="text-sm text-room-charcoal-light">カレンダーを読み込み中...</p>
              ) : calendars.length === 0 ? (
                <p className="text-sm text-room-charcoal-light">
                  カレンダーが見つかりません。Service Accountに編集権限が付与されたカレンダーがありません。
                </p>
              ) : (
                <div className="space-y-3">
                  <select
                    value={selectedCalendarId}
                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                    className="block w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                  >
                    <option value="">カレンダーを選択してください</option>
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.name} {cal.id === currentSettings?.calendar_id ? '(現在選択中)' : ''}
                      </option>
                    ))}
                  </select>

                  {currentSettings && (
                    <div className="text-xs text-room-charcoal-light">
                      <p>現在選択中のカレンダー: <strong>{currentSettings.calendar_name}</strong></p>
                      <p className="mt-1">カレンダーID: {currentSettings.calendar_id}</p>
                    </div>
                  )}

                  <button
                    onClick={saveCalendarSelection}
                    disabled={!selectedCalendarId || saving || selectedCalendarId === currentSettings?.calendar_id}
                    className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? '保存中...' : 'カレンダーを保存'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* OAuth認証セクション */}
          <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
            <h3 className="text-sm font-medium text-room-wood-dark mb-3">
              Googleアカウントで接続（OAuth認証）
            </h3>
            <p className="text-xs text-room-charcoal-light mb-3">
              管理者のGoogleアカウントでログインして接続できます。Service Accountの設定が不要です。
            </p>
            
            {oauthStatus?.connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-700 font-medium">✓ 接続済み</span>
                  {oauthStatus.email && (
                    <span className="text-xs text-room-charcoal-light">
                      ({oauthStatus.email})
                    </span>
                  )}
                </div>
                {oauthStatus.expiresAt && (
                  <p className="text-xs text-room-charcoal-light">
                    有効期限: {new Date(oauthStatus.expiresAt).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={connectOAuth}
                disabled={loadingOAuth}
                className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingOAuth ? '接続中...' : 'Googleアカウントで接続'}
              </button>
            )}
          </div>

          {/* 設定方法の説明 */}
          {!status.connected && (
            <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
              <p className="text-sm font-medium text-room-wood-dark mb-2">
                設定方法（2つの方法から選択）:
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-room-wood-dark mb-1">
                    方法1: Googleアカウントで接続（推奨・簡単）
                  </p>
                  <ol className="text-xs text-room-wood-dark space-y-1 list-decimal list-inside ml-2">
                    <li>Google Cloud Consoleでプロジェクトを作成</li>
                    <li>Google Calendar APIを有効化</li>
                    <li>OAuth 2.0クライアントIDを作成（Webアプリケーション）</li>
                    <li>環境変数（GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET）を設定</li>
                    <li>上記の「Googleアカウントで接続」ボタンをクリック</li>
                  </ol>
                </div>
                <div>
                  <p className="text-sm font-medium text-room-wood-dark mb-1">
                    方法2: Service Accountを使用
                  </p>
                  <ol className="text-xs text-room-wood-dark space-y-1 list-decimal list-inside ml-2">
                    <li>Google Cloud Consoleでプロジェクトを作成</li>
                    <li>Google Calendar APIを有効化</li>
                    <li>Service Accountを作成し、JSONキーをダウンロード</li>
                    <li>Service Accountのメールアドレスをカレンダーに共有（編集権限を付与）</li>
                    <li>環境変数（GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY）を設定</li>
                    <li>接続テストが成功したら、使用するカレンダーを選択</li>
                  </ol>
                </div>
              </div>
              <p className="text-xs text-room-charcoal-light mt-2">
                詳細は <code className="bg-room-base-dark px-1 rounded">ENV_VARIABLES.md</code> を参照してください。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
