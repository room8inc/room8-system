import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export const runtime = 'nodejs'

/**
 * OAuth認証状態を取得
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

    // OAuthトークンを取得
    const { data: tokenData, error } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !tokenData) {
      return NextResponse.json({ connected: false })
    }

    // トークンの有効期限をチェック
    const isExpired = tokenData.expires_at && new Date(tokenData.expires_at) < new Date()

    // Google APIでユーザー情報を取得（メールアドレスを取得）
    let email: string | undefined
    if (!isExpired && tokenData.access_token) {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        })
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json()
          email = userInfo.email
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
      }
    }

    return NextResponse.json({
      connected: !isExpired,
      email: email,
      expiresAt: tokenData.expires_at,
    })
  } catch (error: any) {
    console.error('OAuth status check error:', error)
    return NextResponse.json(
      { error: error.message || '認証状態の取得に失敗しました' },
      { status: 500 }
    )
  }
}

