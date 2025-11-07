/**
 * D1 HTTP Client
 * Cloudflare Workers API経由でD1にアクセスするクライアント
 */

const D1_API_URL = process.env.D1_API_URL || 'https://room8-d1-api.k-tsuruta.workers.dev'
const D1_API_SECRET = process.env.D1_API_SECRET!

interface D1Result<T = any> {
  results: T[]
  success: boolean
  meta?: {
    duration?: number
    rows_read?: number
    rows_written?: number
  }
}

interface D1ExecuteResult {
  success: boolean
  meta?: {
    duration?: number
    changes?: number
    last_row_id?: number
    rows_written?: number
  }
}

export class D1HttpClient {
  /**
   * SELECT文を実行（複数行）
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const response = await fetch(`${D1_API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${D1_API_SECRET}`,
      },
      body: JSON.stringify({ sql, params }),
    })

    if (!response.ok) {
      throw new Error(`D1 query failed: ${response.statusText}`)
    }

    const result: D1Result<T> = await response.json()
    return result.results
  }

  /**
   * SELECT文を実行（単一行）
   */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results.length > 0 ? results[0] : null
  }

  /**
   * INSERT/UPDATE/DELETE文を実行
   */
  async execute(sql: string, params: any[] = []): Promise<D1ExecuteResult> {
    const response = await fetch(`${D1_API_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${D1_API_SECRET}`,
      },
      body: JSON.stringify({ sql, params }),
    })

    if (!response.ok) {
      throw new Error(`D1 execute failed: ${response.statusText}`)
    }

    return await response.json()
  }
}

// シングルトンインスタンス
let d1Client: D1HttpClient | null = null

export function getD1Client(): D1HttpClient {
  if (!d1Client) {
    d1Client = new D1HttpClient()
  }
  return d1Client
}

