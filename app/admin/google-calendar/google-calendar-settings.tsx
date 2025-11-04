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

export function GoogleCalendarSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    checkConnection()
  }, [])

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

          {/* 設定方法の説明 */}
          {!status.connected && (
            <div className="rounded-md bg-room-wood bg-opacity-10 border border-room-wood p-4">
              <p className="text-sm font-medium text-room-wood-dark mb-2">
                設定方法:
              </p>
              <ol className="text-sm text-room-wood-dark space-y-1 list-decimal list-inside">
                <li>Google Cloud Consoleでプロジェクトを作成</li>
                <li>Google Calendar APIを有効化</li>
                <li>Service Accountを作成し、JSONキーをダウンロード</li>
                <li>Service Accountのメールアドレスをカレンダーに共有（編集権限を付与）</li>
                <li>環境変数をVercelに設定</li>
              </ol>
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
