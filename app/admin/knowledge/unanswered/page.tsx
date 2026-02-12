'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface UnansweredQuestion {
  id: string
  line_user_id: string
  user_name: string | null
  user_message: string
  bot_reply: string | null
  intent: string | null
  staff_message: string | null
  is_resolved: boolean
  resolved_knowledge_id: string | null
  created_at: string
}

export default function UnansweredPage() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/admin/unanswered')
      if (!res.ok) throw new Error('取得に失敗しました')
      const data = await res.json()
      setQuestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const markResolved = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/unanswered/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_resolved: true }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      setQuestions(questions.map(q =>
        q.id === id ? { ...q, is_resolved: true } : q
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  const filtered = showResolved
    ? questions
    : questions.filter(q => !q.is_resolved)

  if (loading) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/knowledge"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ナレッジ管理に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            未回答質問
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            LINE Botが回答できなかった質問の一覧です
          </p>
        </div>

        {/* フィルター */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-room-base-dark text-room-main focus:ring-room-main"
            />
            <span className="text-sm text-room-charcoal">解決済みも表示</span>
          </label>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map(q => (
              <div
                key={q.id}
                className={`rounded-lg border p-4 shadow-sm ${
                  q.is_resolved
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : 'bg-room-base-light border-room-base-dark'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-room-charcoal-light">
                        {new Date(q.created_at).toLocaleString('ja-JP')}
                      </span>
                      <span className="text-xs font-medium text-room-charcoal">
                        {q.user_name || '名前なし'}
                      </span>
                      {q.intent && (
                        <span className="rounded bg-room-base-dark px-2 py-0.5 text-xs text-room-charcoal">
                          {q.intent}
                        </span>
                      )}
                      {q.is_resolved && (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          解決済み
                        </span>
                      )}
                    </div>
                    <div className="mb-2">
                      <p className="text-sm font-medium text-room-charcoal">
                        Q: {q.user_message}
                      </p>
                    </div>
                    {q.bot_reply && (
                      <div>
                        <p className="text-sm text-room-charcoal-light">
                          Bot: {q.bot_reply}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {!q.is_resolved && (
                      <>
                        <Link
                          href={`/admin/knowledge/new?category=FAQ&title=${encodeURIComponent(q.user_message)}`}
                          className="rounded bg-room-main px-3 py-1 text-xs text-white hover:bg-room-main-light text-center"
                        >
                          ナレッジに追加
                        </Link>
                        <button
                          onClick={() => markResolved(q.id)}
                          className="rounded bg-room-charcoal-light px-3 py-1 text-xs text-white hover:bg-room-charcoal"
                        >
                          解決済みにする
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center">
            <p className="text-sm text-room-wood-dark">
              {showResolved ? '未回答質問はありません' : '未解決の質問はありません'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
