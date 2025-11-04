import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ログイン済みの場合はダッシュボードにリダイレクト
  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-room-base px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-room-charcoal mb-4">
            Room8
          </h1>
          <p className="text-xl text-room-charcoal-light mb-2">
            コワーキングスペース管理システム
          </p>
          <p className="text-sm text-room-charcoal-light">
            会員の方はログイン、初めての方は新規登録してください
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full rounded-md bg-room-main px-6 py-3 text-center text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 transition-colors"
          >
            ログイン
          </Link>

          <Link
            href="/register"
            className="block w-full rounded-md bg-room-charcoal px-6 py-3 text-center text-white hover:bg-room-charcoal-light focus:outline-none focus:ring-2 focus:ring-room-charcoal focus:ring-offset-2 transition-colors"
          >
            新規会員登録
          </Link>
        </div>

        <div className="text-center">
          <p className="text-xs text-room-charcoal-light">
            © 2025 Room8. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  )
}

