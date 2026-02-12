'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  '基本情報', '料金', '設備・アメニティ', '手続き関連',
  '見学について', '駐車場', '併設サービス', 'FAQ',
]

export default function EditKnowledgePage() {
  const router = useRouter()
  const params = useParams()
  const knowledgeId = params.id as string
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category: '',
    title: '',
    content: '',
    sort_order: 0,
    is_active: true,
  })

  useEffect(() => {
    const fetchEntry = async () => {
      try {
        const res = await fetch('/api/admin/knowledge')
        if (!res.ok) throw new Error('取得に失敗しました')
        const data = await res.json()
        const entry = data.find((e: { id: string }) => e.id === knowledgeId)
        if (!entry) throw new Error('エントリが見つかりません')
        setFormData({
          category: entry.category,
          title: entry.title,
          content: entry.content,
          sort_order: entry.sort_order,
          is_active: entry.is_active,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '取得に失敗しました')
      } finally {
        setFetching(false)
      }
    }
    fetchEntry()
  }, [knowledgeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/knowledge/${knowledgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '更新に失敗しました')
      }

      router.push('/admin/knowledge')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('このナレッジエントリを削除してもよろしいですか？')) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/knowledge/${knowledgeId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '削除に失敗しました')
      }

      router.push('/admin/knowledge')
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/knowledge"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← ナレッジ一覧に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            ナレッジ編集
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <div className="space-y-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-room-charcoal mb-1">
                  カテゴリ <span className="text-red-600">*</span>
                </label>
                <select
                  id="category"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-room-charcoal mb-1">
                  タイトル <span className="text-red-600">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-room-charcoal mb-1">
                  内容 <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="content"
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                />
              </div>

              <div>
                <label htmlFor="sort_order" className="block text-sm font-medium text-room-charcoal mb-1">
                  表示順
                </label>
                <input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-24 rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                />
                <p className="mt-1 text-xs text-room-charcoal-light">
                  同カテゴリ内の表示順（小さい数字が先）
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-sm text-room-charcoal">有効にする</span>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/admin/knowledge"
              className="rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal"
            >
              キャンセル
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50"
            >
              削除
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? '更新中...' : 'ナレッジを更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
