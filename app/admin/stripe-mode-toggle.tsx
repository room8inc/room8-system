'use client'

import { useState, useEffect } from 'react'

export function StripeModeToggle() {
  const [mode, setMode] = useState<'test' | 'live' | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings/stripe-mode')
      .then((res) => res.json())
      .then((data) => {
        setMode(data.mode || 'test')
        setLoading(false)
      })
      .catch(() => {
        setMode('test')
        setLoading(false)
      })
  }, [])

  const handleToggle = async () => {
    if (!mode) return
    const newMode = mode === 'test' ? 'live' : 'test'

    const confirmMsg =
      newMode === 'live'
        ? '本番モードに切り替えます。実際の決済が発生します。よろしいですか？'
        : 'テストモードに切り替えます。'

    if (!confirm(confirmMsg)) return

    setSwitching(true)
    try {
      const res = await fetch('/api/admin/settings/stripe-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      })
      const data = await res.json()
      if (data.success) {
        setMode(newMode)
      }
    } catch {
      // ignore
    } finally {
      setSwitching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-room-base-dark px-3 py-1.5 text-xs text-room-charcoal-light">
        Stripe: 読込中...
      </div>
    )
  }

  const isLive = mode === 'live'

  return (
    <button
      onClick={handleToggle}
      disabled={switching}
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        isLive
          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          isLive ? 'bg-red-500' : 'bg-yellow-500'
        }`}
      />
      Stripe: {isLive ? '本番' : 'テスト'}
      {switching && '...'}
    </button>
  )
}
