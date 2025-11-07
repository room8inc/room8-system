/**
 * Cloudflare Workers - D1 API
 * Vercel Next.jsアプリからD1データベースにアクセスするための薄いAPI層
 */

export interface Env {
  DB: D1Database
  API_SECRET: string // セキュリティ用のシークレット
}

// CORS設定
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 本番では特定のドメインに制限
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // OPTIONSリクエスト（CORS）
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // 認証チェック
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // ルーティング
      if (path === '/query' && request.method === 'POST') {
        return await handleQuery(request, env)
      }
      
      if (path === '/execute' && request.method === 'POST') {
        return await handleExecute(request, env)
      }

      // 404
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders 
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  },
}

/**
 * SELECT文の実行（複数行）
 */
async function handleQuery(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { sql: string; params?: any[] }
  
  const stmt = env.DB.prepare(body.sql)
  const result = body.params ? await stmt.bind(...body.params).all() : await stmt.all()

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * INSERT/UPDATE/DELETE文の実行
 */
async function handleExecute(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { sql: string; params?: any[] }
  
  const stmt = env.DB.prepare(body.sql)
  const result = body.params ? await stmt.bind(...body.params).run() : await stmt.run()

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

