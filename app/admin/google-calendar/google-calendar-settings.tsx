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
  calendar_role: string
  is_active: boolean
}

interface OAuthStatus {
  connected: boolean
  email?: string
  expiresAt?: string
}

interface WatchChannelStatus {
  registered: boolean
  channelId?: string
  expiration?: string
  isExpired?: boolean
  webhookUrl?: string
}

export function GoogleCalendarSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [meetingRoomCalendarId, setMeetingRoomCalendarId] = useState<string>('')
  const [personalCalendarId, setPersonalCalendarId] = useState<string>('')
  const [currentMeetingRoom, setCurrentMeetingRoom] = useState<Settings | null>(null)
  const [currentPersonal, setCurrentPersonal] = useState<Settings | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // 'meeting_room' | 'personal' | null
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null)
  const [loadingOAuth, setLoadingOAuth] = useState(false)
  const [watchChannelStatus, setWatchChannelStatus] = useState<WatchChannelStatus | null>(null)
  const [loadingWatch, setLoadingWatch] = useState(false)

  useEffect(() => {
    checkConnection()
    loadCurrentSettings()
    loadCalendars()
    loadOAuthStatus()
    loadWatchChannelStatus()

    // URLパラメータからsuccess/errorを取得して表示
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')

    if (success) {
      alert(success)
      window.history.replaceState({}, '', window.location.pathname)
      loadOAuthStatus()
      loadCalendars()
      checkConnection()
    }

    if (error) {
      const details = params.get('details')
      let errorMessage = `エラー: ${error}`
      if (details) {
        try {
          const detailsObj = JSON.parse(details)
          errorMessage += `\n\n詳細:\n${JSON.stringify(detailsObj, null, 2)}`
        } catch {
          errorMessage += `\n\n詳細: ${details}`
        }
      }
      console.error('OAuth Error:', error, details)
      alert(errorMessage)
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

  const loadWatchChannelStatus = async () => {
    try {
      const response = await fetch('/api/admin/google-calendar/watch')
      const data = await response.json()
      if (data.registered !== undefined) {
        setWatchChannelStatus(data)
      }
    } catch (error: any) {
      console.error('Failed to load watch channel status:', error)
    }
  }

  const registerWatchChannel = async () => {
    setLoadingWatch(true)
    try {
      const response = await fetch('/api/admin/google-calendar/watch', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Watchチャンネルの登録に失敗しました')
      }

      let message = 'Watchチャンネルを登録しました！'
      if (data.results && data.results.length > 0) {
        message += `\n\n${data.results.length}個のカレンダーにチャンネルを登録:`
        for (const r of data.results) {
          message += `\n  - ${r.calendarRole}: 有効期限 ${new Date(r.expiration).toLocaleString('ja-JP')}`
        }
      }
      if (data.syncResult) {
        message += `\n\n初回同期: ${data.syncResult.synced}件のイベントを同期`
      }
      alert(message)
      await loadWatchChannelStatus()
    } catch (error: any) {
      alert(`Watchチャンネルの登録に失敗しました: ${error.message}`)
    } finally {
      setLoadingWatch(false)
    }
  }

  const connectOAuth = async () => {
    setLoadingOAuth(true)
    try {
      const response = await fetch('/api/admin/google-calendar/oauth/auth')
      const data = await response.json()

      if (!response.ok) {
        let errorMessage = data.error || '認証URLの取得に失敗しました'
        if (data.details) {
          errorMessage += `\n\n${data.details}`
        }
        if (data.missingEnvVars && data.missingEnvVars.length > 0) {
          errorMessage += `\n\n未設定の環境変数:\n${data.missingEnvVars.map((v: string) => `• ${v}`).join('\n')}`
        }
        if (data.debug?.redirectUri) {
          errorMessage += `\n\n実際に使用されているリダイレクトURI:\n${data.debug.redirectUri}\n\nこのURIをGoogle Cloud Consoleの「承認済みのリダイレクトURI」に設定してください。`
        }
        alert(errorMessage)
        setLoadingOAuth(false)
        return
      }

      if (data.authUrl) {
        if (data.redirectUri) {
          const confirmed = confirm(
            `リダイレクトURIを確認してください:\n\n${data.redirectUri}\n\nこのURIがGoogle Cloud Consoleの「承認済みのリダイレクトURI」に設定されているか確認してください。\n\n「OK」をクリックするとGoogle認証画面に移動します。`
          )
          if (!confirmed) {
            setLoadingOAuth(false)
            return
          }
        }
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
        setCurrentMeetingRoom(data.settings)
        setMeetingRoomCalendarId(data.settings.calendar_id)
      }
      if (data.personalSettings) {
        setCurrentPersonal(data.personalSettings)
        setPersonalCalendarId(data.personalSettings.calendar_id)
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

  const saveCalendarSelection = async (role: 'meeting_room' | 'personal') => {
    const calendarId = role === 'meeting_room' ? meetingRoomCalendarId : personalCalendarId
    if (!calendarId) {
      alert('カレンダーを選択してください')
      return
    }

    setSaving(role)
    try {
      const selectedCalendar = calendars.find((cal) => cal.id === calendarId)
      const response = await fetch('/api/admin/google-calendar/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          calendarName: selectedCalendar?.name || calendarId,
          calendarRole: role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '設定の保存に失敗しました')
      }

      const roleLabel = role === 'meeting_room' ? '会議室' : '個人'
      alert(`${roleLabel}カレンダー設定を保存しました！`)
      await loadCurrentSettings()
      await checkConnection()
    } catch (error: any) {
      alert(`設定の保存に失敗しました: ${error.message}`)
    } finally {
      setSaving(null)
    }
  }

  const removeCalendar = async (role: 'meeting_room' | 'personal') => {
    const roleLabel = role === 'meeting_room' ? '会議室' : '個人'
    if (!confirm(`${roleLabel}カレンダーの設定を解除しますか？`)) return

    try {
      const response = await fetch(`/api/admin/google-calendar/settings?calendarRole=${role}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '設定の解除に失敗しました')
      }

      alert(`${roleLabel}カレンダーの設定を解除しました`)
      if (role === 'meeting_room') {
        setCurrentMeetingRoom(null)
        setMeetingRoomCalendarId('')
      } else {
        setCurrentPersonal(null)
        setPersonalCalendarId('')
      }
    } catch (error: any) {
      alert(`設定の解除に失敗しました: ${error.message}`)
    }
  }

  const renderCalendarSelector = (
    role: 'meeting_room' | 'personal',
    label: string,
    description: string,
    selectedId: string,
    setSelectedId: (id: string) => void,
    currentSetting: Settings | null
  ) => (
    <div className="rounded-md bg-room-base p-4 border border-room-base-dark">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-room-charcoal">{label}</h4>
          <p className="text-xs text-room-charcoal-light">{description}</p>
        </div>
        {currentSetting && (
          <button
            onClick={() => removeCalendar(role)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            解除
          </button>
        )}
      </div>

      {currentSetting && (
        <div className="text-xs text-green-700 mb-2 flex items-center gap-1">
          <span>&#10003;</span>
          <span>{currentSetting.calendar_name}</span>
        </div>
      )}

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="block w-full rounded-md border border-room-base-dark bg-white px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
      >
        <option value="">カレンダーを選択</option>
        {calendars.map((cal) => (
          <option key={cal.id} value={cal.id}>
            {cal.name} {cal.id === currentSetting?.calendar_id ? '(現在)' : ''}
          </option>
        ))}
      </select>

      <button
        onClick={() => saveCalendarSelection(role)}
        disabled={!selectedId || saving === role || selectedId === currentSetting?.calendar_id}
        className="mt-2 w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving === role ? '保存中...' : '保存'}
      </button>
    </div>
  )

  return (
    <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-room-charcoal">Googleカレンダー連携</h2>
          <p className="text-sm text-room-charcoal-light mt-1">
            会議室カレンダーと個人カレンダーを設定して、空き状況を2軸で判定します
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
                {status.connected ? '&#10003; 接続済み' : '&#10007; 未接続'}
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
          </div>

          {/* 環境変数の設定状況 */}
          {status.missing && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm font-medium text-room-main-dark mb-2">
                未設定の環境変数:
              </p>
              <ul className="text-sm text-room-main-dark space-y-1">
                {status.missing.serviceAccountEmail && (
                  <li>&#8226; GOOGLE_SERVICE_ACCOUNT_EMAIL</li>
                )}
                {status.missing.privateKey && <li>&#8226; GOOGLE_PRIVATE_KEY</li>}
                {status.missing.calendarId && <li>&#8226; GOOGLE_CALENDAR_ID</li>}
              </ul>
            </div>
          )}

          {/* カレンダー選択（2軸） */}
          {oauthStatus?.connected && (
            <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-room-wood-dark">
                  カレンダー設定（2軸）
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
                  カレンダーが見つかりません。
                </p>
              ) : (
                <div className="space-y-4">
                  {renderCalendarSelector(
                    'meeting_room',
                    '会議室カレンダー',
                    '会議室の予約状況を管理するカレンダー。全ユーザーの空き判定に使用。',
                    meetingRoomCalendarId,
                    setMeetingRoomCalendarId,
                    currentMeetingRoom
                  )}
                  {renderCalendarSelector(
                    'personal',
                    '個人カレンダー（鶴田）',
                    '非会員の予約時、この予定もチェックして鶴田さんの対応可能時間を判定。',
                    personalCalendarId,
                    setPersonalCalendarId,
                    currentPersonal
                  )}
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
              管理者のGoogleアカウントでログインして接続できます。
            </p>

            {oauthStatus?.connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-700 font-medium">&#10003; 接続済み</span>
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

          {/* Watchチャンネル登録セクション */}
          {oauthStatus?.connected && (
            <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
              <h3 className="text-sm font-medium text-room-wood-dark mb-3">
                リアルタイム同期設定（Push Notifications）
              </h3>
              <p className="text-xs text-room-charcoal-light mb-3">
                Googleカレンダーの変更をリアルタイムで検知して自動同期します。
                全アクティブカレンダーにWatchチャンネルを登録します。
              </p>

              {watchChannelStatus?.registered ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${watchChannelStatus.isExpired ? 'text-red-700' : 'text-green-700'}`}>
                      {watchChannelStatus.isExpired ? '&#9888; 有効期限切れ' : '&#10003; 登録済み'}
                    </span>
                  </div>
                  {watchChannelStatus.expiration && (
                    <p className="text-xs text-room-charcoal-light">
                      有効期限: {new Date(watchChannelStatus.expiration).toLocaleString('ja-JP')}
                    </p>
                  )}
                  {watchChannelStatus.isExpired && (
                    <p className="text-xs text-red-700">
                      チャンネルの有効期限が切れています。再登録してください。
                    </p>
                  )}
                  <button
                    onClick={registerWatchChannel}
                    disabled={loadingWatch}
                    className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {loadingWatch ? '登録中...' : 'チャンネルを再登録'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={registerWatchChannel}
                  disabled={loadingWatch}
                  className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingWatch ? '登録中...' : 'Watchチャンネルを登録'}
                </button>
              )}
              <p className="text-xs text-room-charcoal-light mt-2">
                注意: チャンネルの有効期限は約7日間です。毎日3時に定期同期も実行されます。
              </p>
            </div>
          )}

          {/* 設定方法の説明 */}
          {!status.connected && !oauthStatus?.connected && (
            <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
              <p className="text-sm font-medium text-room-wood-dark mb-2">
                設定方法:
              </p>
              <div>
                <p className="text-sm font-medium text-room-wood-dark mb-1">
                  Googleアカウントで接続（推奨・簡単）
                </p>
                <ol className="text-xs text-room-wood-dark space-y-1 list-decimal list-inside ml-2">
                  <li>Google Cloud Consoleでプロジェクトを作成</li>
                  <li>Google Calendar APIを有効化</li>
                  <li>OAuth 2.0クライアントIDを作成（Webアプリケーション）</li>
                  <li>環境変数（GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET）を設定</li>
                  <li>上記の「Googleアカウントで接続」ボタンをクリック</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
