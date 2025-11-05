import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export const runtime = 'nodejs'

/**
 * Google OAuth認証を開始（認証URLを生成）
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

    // リダイレクトURIを決定
    // 優先順位: 1. 環境変数 GOOGLE_OAUTH_REDIRECT_URI > 2. NEXT_PUBLIC_SITE_URL > 3. リクエストから取得
    // 注意: VERCEL_URLはプレビュー環境のURLになる可能性があるため、使用しない
    let redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
    
    if (!redirectUri) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      
      if (siteUrl) {
        // NEXT_PUBLIC_SITE_URLは既に https:// を含む場合があるので、適切に処理
        const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`
        redirectUri = `${baseUrl}/api/admin/google-calendar/oauth/callback`
      } else {
        // リクエストから取得（fallback）
        const protocol = request.headers.get('x-forwarded-proto') || 'https'
        const host = request.headers.get('host') || 'room8-system.vercel.app'
        redirectUri = `${protocol}://${host}/api/admin/google-calendar/oauth/callback`
      }
    }

    // デバッグ用: リダイレクトURIをログに出力
    console.log('OAuth redirect URI:', redirectUri)
    console.log('Environment variables:', {
      GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      host: request.headers.get('host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    })

    // 環境変数の設定状況をチェック
    if (!clientId) {
      return NextResponse.json(
        { 
          error: 'GOOGLE_OAUTH_CLIENT_ID環境変数が設定されていません',
          details: 'Vercel Dashboard > Settings > Environment Variables で設定してください。',
          missingEnvVars: ['GOOGLE_OAUTH_CLIENT_ID'],
          debug: {
            redirectUri: redirectUri,
          },
        },
        { status: 500 }
      )
    }

    if (!clientSecret) {
      return NextResponse.json(
        { 
          error: 'GOOGLE_OAUTH_CLIENT_SECRET環境変数が設定されていません',
          details: 'Vercel Dashboard > Settings > Environment Variables で設定してください。',
          missingEnvVars: ['GOOGLE_OAUTH_CLIENT_SECRET'],
          debug: {
            redirectUri: redirectUri,
          },
        },
        { status: 500 }
      )
    }

    // OAuth認証URLを生成
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.readonly')
    authUrl.searchParams.set('access_type', 'offline') // リフレッシュトークンを取得するため
    authUrl.searchParams.set('prompt', 'consent') // 常に同意画面を表示（リフレッシュトークンを確実に取得）

    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      redirectUri: redirectUri, // デバッグ用
    })
  } catch (error: any) {
    console.error('Google OAuth auth URL generation error:', error)
    return NextResponse.json(
      { error: error.message || '認証URLの生成に失敗しました' },
      { status: 500 }
    )
  }
}

