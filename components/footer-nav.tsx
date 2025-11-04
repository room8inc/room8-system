'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import QRScannerModal from '@/components/qr-scanner-modal'

export default function FooterNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)
  const [checkinMode, setCheckinMode] = useState<'checkin' | 'checkout'>('checkin')
  const supabase = createClient()

  // 現在のチェックイン状態を確認
  useEffect(() => {
    const checkCurrentStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: currentCheckin } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .is('checkout_at', null)
        .single()

      // チェックイン中ならチェックアウトモード、そうでなければチェックインモード
      setCheckinMode(currentCheckin ? 'checkout' : 'checkin')
    }

    checkCurrentStatus()
  }, [supabase])

  const handleScanClick = () => {
    setIsScanModalOpen(true)
  }

  const handleScanSuccess = () => {
    // スキャン成功後、ページをリフレッシュ
    router.refresh()
    // モードを再確認
    setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: currentCheckin } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .is('checkout_at', null)
        .single()

      setCheckinMode(currentCheckin ? 'checkout' : 'checkin')
    }, 500)
  }

  const handleScanClose = () => {
    setIsScanModalOpen(false)
  }

  // ログインページなどでは表示しない
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto grid max-w-7xl grid-cols-4">
          {/* ホーム */}
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
              pathname === '/dashboard'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-xs font-medium">ホーム</span>
          </Link>

          {/* スキャン */}
          <button
            onClick={handleScanClick}
            className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
              pathname === '/checkin' || isScanModalOpen
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2.01M8 8h2.01M5 12h2.01M8 12h2.01M5 16h2.01M8 16h2.01M9 4h2.01M12 4h2.01M9 8h2.01M12 8h2.01M9 12h2.01M12 12h2.01M9 16h2.01M12 16h2.01"
              />
            </svg>
            <span className="text-xs font-medium">スキャン</span>
          </button>

          {/* 会議室 */}
          <Link
            href="/meeting-rooms"
            className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
              pathname === '/meeting-rooms'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span className="text-xs font-medium">会議室</span>
          </Link>

          {/* 会員証 */}
          <Link
            href="/member-card"
            className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
              pathname === '/member-card'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
            <span className="text-xs font-medium">会員証</span>
          </Link>
        </div>
      </nav>

      {/* スキャンモーダル */}
      <QRScannerModal
        isOpen={isScanModalOpen}
        onClose={handleScanClose}
        onSuccess={handleScanSuccess}
        mode={checkinMode}
      />
    </>
  )
}

