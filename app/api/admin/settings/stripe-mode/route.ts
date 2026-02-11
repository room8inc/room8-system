import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/utils/admin'
import { createClient } from '@/lib/supabase/server'
import { getStripeMode, setStripeMode } from '@/lib/stripe/mode'
import type { StripeMode } from '@/lib/stripe/mode'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const mode = await getStripeMode()
    return NextResponse.json({ mode })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { mode } = body

    if (mode !== 'test' && mode !== 'live') {
      return NextResponse.json({ error: 'mode は "test" または "live" を指定してください' }, { status: 400 })
    }

    await setStripeMode(mode as StripeMode)
    console.log(`[Admin] Stripe mode changed to: ${mode} by ${user.email}`)

    return NextResponse.json({ success: true, mode })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
