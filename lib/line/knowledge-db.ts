/**
 * LINE Bot ナレッジDB取得モジュール
 * Supabaseからアクティブなナレッジエントリを取得し、マークダウンに組み立てる
 */

import { createServiceClient } from '@/lib/supabase/service-client'
import { getCached, cache } from '@/lib/cache/vercel-kv'

const KNOWLEDGE_CACHE_KEY = 'line-bot:knowledge:markdown'
const KNOWLEDGE_CACHE_TTL = 900 // 15分

interface KnowledgeEntry {
  id: string
  category: string
  title: string
  content: string
  sort_order: number
}

/**
 * DBからアクティブなナレッジエントリを取得してマークダウンに組み立てる
 */
export async function getKnowledgeFromDB(): Promise<string> {
  return getCached(KNOWLEDGE_CACHE_KEY, async () => {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('line_bot_knowledge')
      .select('id, category, title, content, sort_order')
      .eq('is_active', true)
      .order('category')
      .order('sort_order', { ascending: true })

    if (error) {
      throw new Error(`ナレッジ取得エラー: ${error.message}`)
    }

    if (!data || data.length === 0) {
      throw new Error('ナレッジデータが空です')
    }

    return buildMarkdown(data as KnowledgeEntry[])
  }, KNOWLEDGE_CACHE_TTL)
}

/**
 * キャッシュを即時クリア（管理画面で編集した場合に呼ぶ）
 */
export async function invalidateKnowledgeCache(): Promise<void> {
  await cache.delete(KNOWLEDGE_CACHE_KEY)
}

/**
 * ナレッジエントリをマークダウンに組み立てる
 */
function buildMarkdown(entries: KnowledgeEntry[]): string {
  const lines: string[] = ['# Room8 コワーキングスペース ナレッジベース', '']

  // カテゴリごとにグルーピング
  const categories = new Map<string, KnowledgeEntry[]>()
  for (const entry of entries) {
    const list = categories.get(entry.category) || []
    list.push(entry)
    categories.set(entry.category, list)
  }

  for (const [category, items] of categories) {
    lines.push(`## ${category}`, '')
    for (const item of items) {
      lines.push(`### ${item.title}`, '', item.content, '')
    }
  }

  return lines.join('\n')
}
