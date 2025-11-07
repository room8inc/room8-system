/**
 * Vercel KV Cache Helper
 * Redis互換のキャッシュ層（Vercel KV使用）
 */

// Vercel KVは後でインストール
// 今は、メモリキャッシュで代替実装

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // 期限切れチェック
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000)
    this.cache.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }
}

// シングルトンインスタンス
const cache = new MemoryCache()

export { cache }

/**
 * キャッシュヘルパー関数
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // キャッシュをチェック
  const cached = await cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // キャッシュミス: データを取得
  const data = await fetcher()
  
  // キャッシュに保存
  await cache.set(key, data, ttlSeconds)
  
  return data
}

/**
 * キャッシュキーの生成
 */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':')
}

