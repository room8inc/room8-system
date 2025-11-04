'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
// @ts-ignore - html5-qrcodeの型定義が不完全な場合があるため
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  mode: 'checkin' | 'checkout' | 'auto' // autoは自動判定
}

export function QRScannerModal({ isOpen, onClose, onSuccess, mode }: QRScannerModalProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'checking-in' | 'checking-out' | 'success'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const qrCodeRegionId = 'qr-scanner-modal'
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  const supabase = createClient()

  // モーダルが開いたら自動的にカメラを起動
  useEffect(() => {
    if (isOpen && !scanning) {
      startScanning()
    } else if (!isOpen) {
      stopScanning()
    }

    return () => {
      stopScanning()
    }
  }, [isOpen])

  const startScanning = async () => {
    setError(null)
    setStatus('idle')
    setMessage(null)

    try {
      // カメラアクセス許可確認
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop())

      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
        html5QrCodeRef.current.clear()
      }

      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await handleQRCodeScanned(decodedText)
        },
        () => {
          // 読み取りエラーは無視
        }
      )

      setScanning(true)
    } catch (err) {
      console.error('Camera access error:', err)
      setError('カメラへのアクセスに失敗しました。ブラウザの設定でカメラの使用を許可してください。')
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
        html5QrCodeRef.current = null
      } catch (err) {
        console.error('Stop scanning error:', err)
      }
    }
    setScanning(false)
  }

  const handleQRCodeScanned = async (venueId: string) => {
    await stopScanning()

    if (!venueId || venueId.trim() === '') {
      setError('無効なQRコードです')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('ログインが必要です')
      return
    }

    // モードがautoの場合は現在の状態を確認
    if (mode === 'auto') {
      const { data: currentCheckin } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .is('checkout_at', null)
        .single()

      if (currentCheckin) {
        await handleCheckout(currentCheckin.id, venueId)
      } else {
        await handleCheckin(venueId)
      }
    } else if (mode === 'checkin') {
      await handleCheckin(venueId)
    } else if (mode === 'checkout') {
      const { data: currentCheckin } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .is('checkout_at', null)
        .single()

      if (!currentCheckin) {
        setError('チェックインしていません')
        return
      }

      await handleCheckout(currentCheckin.id, venueId)
    }
  }

  const handleCheckin = async (venueId: string) => {
    setStatus('checking-in')
    setMessage('チェックイン中...')
    setError(null)

    try {
      const { data: { user }, error: userAuthError } = await supabase.auth.getUser()

      if (userAuthError || !user) {
        throw new Error('ログインが必要です')
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('member_type')
        .eq('id', user.id)
        .single()

      if (userError) {
        throw new Error(`ユーザー情報の取得に失敗しました: ${userError.message}`)
      }

      let planIdAtCheckin = null
      if (userData.member_type === 'regular') {
        const { data: activePlan } = await supabase
          .from('user_plans')
          .select('plan_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('ended_at', null)
          .single()

        if (activePlan) {
          planIdAtCheckin = activePlan.plan_id
        }
      }

      const { error: insertError } = await supabase
        .from('checkins')
        .insert({
          user_id: user.id,
          checkin_at: new Date().toISOString(),
          venue_id: venueId,
          member_type_at_checkin: userData.member_type || 'regular',
          ...(planIdAtCheckin && { plan_id_at_checkin: planIdAtCheckin }),
        })

      if (insertError) {
        throw new Error(`チェックインに失敗しました: ${insertError.message}`)
      }

      setStatus('success')
      setMessage('チェックインしました！')
      
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Checkin error:', err)
      setError(err instanceof Error ? err.message : 'チェックインに失敗しました')
      setStatus('idle')
      setMessage(null)
    }
  }

  const handleCheckout = async (checkinId: string, venueId: string) => {
    setStatus('checking-out')
    setMessage('チェックアウト中...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('ログインが必要です')
      }

      const { data: checkinData, error: fetchError } = await supabase
        .from('checkins')
        .select('checkin_at')
        .eq('id', checkinId)
        .single()

      if (fetchError || !checkinData) {
        throw new Error('チェックイン情報の取得に失敗しました')
      }

      const checkinAt = new Date(checkinData.checkin_at)
      const checkoutAt = new Date()
      const durationMinutes = Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / (1000 * 60))

      const { error: updateError } = await supabase
        .from('checkins')
        .update({
          checkout_at: checkoutAt.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', checkinId)

      if (updateError) {
        throw new Error(`チェックアウトに失敗しました: ${updateError.message}`)
      }

      setStatus('success')
      setMessage(`チェックアウトしました！（滞在時間: ${durationMinutes}分）`)

      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'チェックアウトに失敗しました')
      setStatus('idle')
      setMessage(null)
    }
  }

  if (!isOpen) return null

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-room-charcoal bg-opacity-50">
        <div className="relative w-full max-w-md rounded-lg bg-room-base-light p-6 shadow-xl border-2 border-room-wood">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>

        <h2 className="mb-4 text-xl font-bold text-room-charcoal">
          {mode === 'checkin' ? 'チェックイン' : mode === 'checkout' ? 'チェックアウト' : 'チェックイン / チェックアウト'}
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-room-main bg-opacity-10 border border-room-main p-3">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        {message && (
          <div className={`mb-4 rounded-md p-3 ${
            status === 'success' ? 'bg-room-main bg-opacity-20 border border-room-main' : 'bg-room-main bg-opacity-10 border border-room-main'
          }`}>
            <p className={`text-sm ${
              status === 'success' ? 'text-room-main-dark' : 'text-room-main-dark'
            }`}>
              {message}
            </p>
          </div>
        )}

        <div className="rounded-lg bg-room-base-dark p-4">
          <div id={qrCodeRegionId} className="aspect-square w-full rounded-lg"></div>
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={stopScanning}
            className="rounded-md bg-room-charcoal px-4 py-2 text-sm text-white hover:bg-room-charcoal-light"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}

