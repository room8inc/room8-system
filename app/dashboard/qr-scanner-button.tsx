'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRScannerModal } from '@/components/qr-scanner-modal'

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

