/**
 * Vercel KV Cache Helper
 * Redis互換の本格的なキャッシュ層
 */

import { kv } from '@vercel/kv'

// 💡 Vercel KVのラッパー
// KV_REST_API_URL または KV_REDIS_URL のどちらかがあれば動作
const isKVAvailable = () => {
  return !!(process.env.KV_REST_API_URL || process.env.KV_REDIS_URL)
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      // Vercel KVが利用可能な場合
      if (isKVAvailable()) {
        return await kv.get<T>(key)
      }
      // ローカル開発時はnull（キャッシュなし）
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  },

  async set<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
    try {
      // Vercel KVが利用可能な場合
      if (isKVAvailable()) {
        await kv.set(key, value, { ex: ttlSeconds })
      }
      // ローカル開発時は何もしない
    } catch (error) {
      console.error('Cache set error:', error)
      // キャッシュエラーは無視（アプリケーションの動作には影響しない）
    }
  },

  async delete(key: string): Promise<void> {
    try {
      if (isKVAvailable()) {
        await kv.del(key)
      }
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  },

  async clear(): Promise<void> {
    try {
      if (isKVAvailable()) {
        await kv.flushall()
      }
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }
}

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
    // 💡 本番環境ではデバッグログを削減（必要に応じて有効化）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache HIT] ${key}`)
    }
    return cached
  }

  // キャッシュミス: データを取得
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache MISS] ${key}`)
  }
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

