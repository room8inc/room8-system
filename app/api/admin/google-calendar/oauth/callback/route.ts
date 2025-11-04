import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export const runtime = 'nodejs'

/**
 * Google OAuth認証のコールバック（トークンを取得して保存）
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect('/login?error=認証が必要です')
    }

    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.redirect('/admin/google-calendar?error=管理者権限が必要です')
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`/admin/google-calendar?error=${encodeURIComponent(error)}`)
    }

    if (!code) {
      return NextResponse.redirect('/admin/google-calendar?error=認証コードが取得できませんでした')
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/google-calendar/oauth/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect('/admin/google-calendar?error=OAuth設定が不完全です')
    }

    // アクセストークンを取得
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange error:', errorData)
      return NextResponse.redirect(
        `/admin/google-calendar?error=${encodeURIComponent(errorData.error || 'トークン取得に失敗しました')}`
      )
    }

    const tokenData = await tokenResponse.json()

    // トークンをデータベースに保存
    // 既存のトークンを削除（アクティブなトークンは1つだけ）
    await supabase
      .from('google_oauth_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // 全削除

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null

    const { error: insertError } = await supabase
      .from('google_oauth_tokens')
      .insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || null,
      })

    if (insertError) {
      console.error('Token save error:', insertError)
      return NextResponse.redirect('/admin/google-calendar?error=トークンの保存に失敗しました')
    }

    return NextResponse.redirect('/admin/google-calendar?success=Googleアカウントとの連携に成功しました')
  } catch (error: any) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      `/admin/google-calendar?error=${encodeURIComponent(error.message || '認証処理中にエラーが発生しました')}`
    )
  }
}

