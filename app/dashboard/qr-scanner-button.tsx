'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// 💡 動的インポート: QRスキャナーは必要な時だけロード（約500KB削減）
const QRScannerModal = dynamic(
  () => import('@/components/qr-scanner-modal').then(mod => ({ default: mod.QRScannerModal })),
  { 
    ssr: false,
    loading: () => <div>読み込み中...</div>
  }
)

interface QRScannerButtonProps {
  mode: 'checkin' | 'checkout' | 'auto'
  buttonText: string
  buttonClassName?: string
}

export function QRScannerButton({ mode, buttonText, buttonClassName }: QRScannerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    router.refresh() // ダッシュボードを更新
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={buttonClassName || 'rounded-md bg-room-main px-4 py-2 text-white hover:bg-room-main-light'}
      >
        {buttonText}
      </button>
      <QRScannerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={handleSuccess}
        mode={mode}
      />
    </>
  )
}

