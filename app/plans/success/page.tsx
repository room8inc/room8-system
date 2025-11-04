import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SuccessPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-room-main">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-room-charcoal">
            ご契約ありがとうございます
          </h1>
          <p className="mt-4 text-lg text-room-charcoal-light">
            プラン契約が完了しました。
          </p>
          <p className="mt-2 text-sm text-room-charcoal-light">
            ご利用いただき、ありがとうございます。
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-block rounded-md bg-room-main px-6 py-3 text-base font-medium text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2"
            >
              ダッシュボードに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

