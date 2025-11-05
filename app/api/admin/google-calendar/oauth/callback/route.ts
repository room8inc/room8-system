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

    console.log('OAuth callback:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri,
      code: code ? `${code.substring(0, 20)}...` : null,
    })

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
      const errorText = await tokenResponse.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || 'トークン取得に失敗しました' }
      }
      console.error('Token exchange error:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorData,
      })
      return NextResponse.redirect(
        `/admin/google-calendar?error=${encodeURIComponent(errorData.error_description || errorData.error || 'トークン取得に失敗しました')}`
      )
    }

    const tokenData = await tokenResponse.json()

    // トークンをデータベースに保存
    // 既存のトークンを削除（アクティブなトークンは1つだけ）
    // まず既存のトークンを取得してから削除
    const { data: existingTokens, error: selectError } = await supabase
      .from('google_oauth_tokens')
      .select('id')

    if (selectError) {
      console.error('Token select error:', selectError)
      // 選択エラーは無視して続行（既存トークンがない場合もある）
    } else if (existingTokens && existingTokens.length > 0) {
      // 既存のトークンを削除
      const { error: deleteError } = await supabase
        .from('google_oauth_tokens')
        .delete()
        .in('id', existingTokens.map(t => t.id))

      if (deleteError) {
        console.error('Token delete error:', deleteError)
        // 削除エラーは無視して続行（既存トークンがない場合もある）
      }
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null

    const { error: insertError, data: insertData } = await supabase
      .from('google_oauth_tokens')
      .insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || null,
      })
      .select()

    if (insertError) {
      console.error('Token save error:', insertError)
      console.error('Token data:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
      })
      return NextResponse.redirect(
        `/admin/google-calendar?error=${encodeURIComponent(`トークンの保存に失敗しました: ${insertError.message}`)}`
      )
    }

    console.log('Token saved successfully:', {
      id: insertData?.[0]?.id,
      hasAccessToken: !!insertData?.[0]?.access_token,
      hasRefreshToken: !!insertData?.[0]?.refresh_token,
    })

    return NextResponse.redirect('/admin/google-calendar?success=Googleアカウントとの連携に成功しました')
  } catch (error: any) {
    console.error('Google OAuth callback error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.redirect(
      `/admin/google-calendar?error=${encodeURIComponent(error.message || '認証処理中にエラーが発生しました')}`
    )
  }
}

