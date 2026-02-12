'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface KnowledgeEntry {
  id: string
  category: string
  title: string
  content: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  '基本情報', '料金', '設備・アメニティ', '手続き関連',
  '見学について', '駐車場', '併設サービス', 'FAQ',
]

export default function KnowledgePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('')

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/admin/knowledge')
      if (!res.ok) throw new Error('取得に失敗しました')
      const data = await res.json()
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (entry: KnowledgeEntry) => {
    try {
      const res = await fetch(`/api/admin/knowledge/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !entry.is_active }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      setEntries(entries.map(e =>
        e.id === entry.id ? { ...e, is_active: !e.is_active } : e
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  // カテゴリでグループ化
  const filtered = filterCategory
    ? entries.filter(e => e.category === filterCategory)
    : entries
  const grouped = new Map<string, KnowledgeEntry[]>()
  for (const entry of filtered) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

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
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← 管理者画面に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            ナレッジ管理
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            LINE Botが回答に使用するRoom8の情報を管理します
          </p>
        </div>

        {/* アクションバー */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/knowledge/new"
            className="inline-block rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
          >
            + 新規追加
          </Link>
          <Link
            href="/admin/knowledge/unanswered"
            className="inline-block rounded-md bg-room-wood px-4 py-2 text-sm text-white hover:opacity-90"
          >
            未回答質問を見る
          </Link>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none"
          >
            <option value="">全カテゴリ</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        {/* カテゴリ別表示 */}
        {Array.from(grouped).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-room-charcoal">
              {category}
              <span className="ml-2 text-sm font-normal text-room-charcoal-light">
                ({items.length}件)
              </span>
            </h2>
            <div className="space-y-3">
              {items.map(entry => (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-4 shadow-sm ${
                    entry.is_active
                      ? 'bg-room-base-light border-room-base-dark'
                      : 'bg-gray-100 border-gray-300 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-room-charcoal">
                        {entry.title}
                      </h3>
                      <p className="mt-1 text-xs text-room-charcoal-light whitespace-pre-wrap line-clamp-3">
                        {entry.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => toggleActive(entry)}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          entry.is_active
                            ? 'bg-room-main text-white'
                            : 'bg-room-charcoal-light text-white'
                        }`}
                      >
                        {entry.is_active ? '有効' : '無効'}
                      </button>
                      <Link
                        href={`/admin/knowledge/${entry.id}/edit`}
                        className="text-sm text-room-main hover:text-room-main-light"
                      >
                        編集
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center">
            <p className="text-sm text-room-wood-dark">
              ナレッジエントリがありません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
