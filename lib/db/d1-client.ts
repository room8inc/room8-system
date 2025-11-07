/**
 * D1 Database Client
 * Cloudflare D1用のデータベースクライアント
 */

import { getRequestContext } from '@cloudflare/next-on-pages'

export type D1Database = any // Cloudflare D1の型

/**
 * D1データベースインスタンスを取得
 * Cloudflare Workers環境でのみ動作
 */
export function getD1(): D1Database {
  try {
    const context = getRequestContext()
    return context.env.DB
  } catch (error) {
    throw new Error('D1 database is only available in Cloudflare Workers environment')
  }
}

/**
 * クエリ結果の型
 */
export interface D1Result<T = any> {
  results: T[]
  success: boolean
  meta: {
    duration: number
    rows_read: number
    rows_written: number
  }
}

/**
 * D1クエリヘルパー
 */
export class D1Client {
  constructor(private db: D1Database) {}

  /**
   * SELECT文を実行
   */
  async selectOne<T>(query: string, params: any[] = []): Promise<T | null> {
    const result = await this.db.prepare(query).bind(...params).first()
    return result as T | null
  }

  /**
   * SELECT文を実行（複数行）
   */
  async selectMany<T>(query: string, params: any[] = []): Promise<T[]> {
    const result = await this.db.prepare(query).bind(...params).all()
    return result.results as T[]
  }

  /**
   * INSERT/UPDATE/DELETE文を実行
   */
  async execute(query: string, params: any[] = []): Promise<D1Result> {
    const result = await this.db.prepare(query).bind(...params).run()
    return result
  }

  /**
   * トランザクション実行
   */
  async transaction<T>(callback: (db: D1Database) => Promise<T>): Promise<T> {
    return callback(this.db)
  }
}

/**
 * D1クライアントインスタンスを取得
 */
export function createD1Client(): D1Client {
  const db = getD1()
  return new D1Client(db)
}

