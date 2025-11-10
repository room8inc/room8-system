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
        .select('is_staff')
        .eq('id', user.id)
        .single()

      if (userError) {
        throw new Error(`ユーザー情報の取得に失敗しました: ${userError.message}`)
      }

      // 利用者の場合、スタッフレコードと法人ユーザーIDを取得
      let staffMemberId: string | null = null
      let planOwnerUserId = user.id
      if (userData?.is_staff === true) {
        const { data: staffMember, error: staffError } = await supabase
          .from('staff_members')
          .select('id, company_user_id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (staffError && staffError.code !== 'PGRST116') {
          console.warn('Staff member fetch warning:', staffError)
        } else if (staffMember) {
          staffMemberId = staffMember.id
          if (staffMember.company_user_id) {
            planOwnerUserId = staffMember.company_user_id
          }
        }
      }

      // プラン契約があるかチェック
      const { data: activePlan, error: activePlanError } = await supabase
        .from('user_plans')
        .select('plan_id')
        .eq('user_id', planOwnerUserId)
        .eq('status', 'active')
        .is('ended_at', null)
        .maybeSingle()

      if (activePlanError && activePlanError.code !== 'PGRST116') {
        console.warn('Active plan fetch warning:', activePlanError)
      }

      const planIdAtCheckin = activePlan?.plan_id || null
      const memberTypeAtCheckin: 'regular' | 'dropin' = planIdAtCheckin ? 'regular' : 'dropin'

      // チェックインを作成
      const { data: checkinData, error: insertError } = await supabase
        .from('checkins')
        .insert({
          user_id: user.id,
          checkin_at: new Date().toISOString(),
          venue_id: venueId,
          member_type_at_checkin: memberTypeAtCheckin,
          ...(planIdAtCheckin && { plan_id_at_checkin: planIdAtCheckin }),
          ...(staffMemberId && { staff_member_id: staffMemberId }),
        })
        .select('id')
        .single()

      if (insertError || !checkinData) {
        throw new Error(`チェックインに失敗しました: ${insertError?.message || '不明なエラー'}`)
      }

      // ドロップイン会員の場合はクレジットカード登録と未決済チェックアウトを確認
      if (memberTypeAtCheckin === 'dropin') {
        setMessage('確認中...')
        
        try {
          const checkResponse = await fetch('/api/checkin/check-payment-method')
          
          let checkData
          try {
            checkData = await checkResponse.json()
          } catch (jsonError) {
            console.error('Failed to parse response:', jsonError)
            await supabase
              .from('checkins')
              .delete()
              .eq('id', checkinData.id)
            throw new Error('確認に失敗しました（レスポンスの解析エラー）')
          }

          if (!checkResponse.ok) {
            await supabase
              .from('checkins')
              .delete()
              .eq('id', checkinData.id)
            throw new Error(checkData?.error || '確認に失敗しました')
          }

          // 未決済のチェックアウトがある場合はチェックインを制限
          if (checkData.hasUnpaidCheckouts) {
            await supabase
              .from('checkins')
              .delete()
              .eq('id', checkinData.id)
            
            throw new Error('未決済の利用があります。先に支払いを完了してください。')
          }

          // クレジットカードが登録されていない場合は案内
          if (!checkData.hasPaymentMethod) {
            await supabase
              .from('checkins')
              .delete()
              .eq('id', checkinData.id)
            
            throw new Error('クレジットカードが登録されていません。プロフィール画面でカード情報を登録してください。')
          }
        } catch (checkError: any) {
          console.error('Check payment method error:', checkError)
          
          // エラーの場合、チェックインを削除
          try {
            await supabase
              .from('checkins')
              .delete()
              .eq('id', checkinData.id)
          } catch (deleteError) {
            console.error('Failed to delete checkin:', deleteError)
          }
          
          const errorMessage = checkError instanceof Error ? checkError.message : String(checkError) || '確認に失敗しました'
          throw new Error(errorMessage)
        }
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
        .select('checkin_at, member_type_at_checkin, plan_id_at_checkin')
        .eq('id', checkinId)
        .single()

      if (fetchError || !checkinData) {
        throw new Error('チェックイン情報の取得に失敗しました')
      }

      const checkinAt = new Date(checkinData.checkin_at)
      const checkoutAt = new Date()
      const durationMinutes = Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / (1000 * 60))

      // 会員の場合は時間外利用を計算
      let isOvertime = false
      let overtimeMinutes = 0
      let overtimeFee = 0

      if (checkinData.member_type_at_checkin === 'regular' && checkinData.plan_id_at_checkin) {
        // プラン情報を取得
        const { data: planData } = await supabase
          .from('plans')
          .select('start_time, end_time, available_days')
          .eq('id', checkinData.plan_id_at_checkin)
          .single()

        if (planData) {
          const { calculateOvertime } = await import('@/lib/utils/overtime')
          const overtimeResult = calculateOvertime(
            checkinAt,
            checkoutAt,
            {
              startTime: planData.start_time,
              endTime: planData.end_time,
              availableDays: planData.available_days,
            }
          )

          isOvertime = overtimeResult.isOvertime
          overtimeMinutes = overtimeResult.overtimeMinutes
          overtimeFee = overtimeResult.overtimeFee
        }
      }

      // チェックアウト情報を更新
      const { error: updateError } = await supabase
        .from('checkins')
        .update({
          checkout_at: checkoutAt.toISOString(),
          duration_minutes: durationMinutes,
          is_overtime: isOvertime,
          overtime_minutes: isOvertime ? overtimeMinutes : null,
          overtime_fee: isOvertime ? overtimeFee : 0,
        })
        .eq('id', checkinId)

      if (updateError) {
        throw new Error(`チェックアウトに失敗しました: ${updateError.message}`)
      }

      // ドロップイン会員の場合は料金計算と決済処理を実行
      if (checkinData.member_type_at_checkin === 'dropin') {
        setMessage('料金計算中...')
        
        try {
          const paymentResponse = await fetch('/api/checkout/calculate-and-refund', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              checkinId: checkinId,
            }),
          })

          const paymentData = await paymentResponse.json()

          if (!paymentResponse.ok) {
            throw new Error(paymentData.error || '料金計算に失敗しました')
          }

          // 決済成功の場合
          if (paymentData.success) {
            setStatus('success')
            setMessage(`チェックアウトしました！（滞在時間: ${durationMinutes}分、料金: ${paymentData.actualFee}円）`)
          } else {
            // 決済失敗の場合（未決済として記録済み）
            setStatus('success')
            setMessage(`チェックアウトしました！（滞在時間: ${durationMinutes}分）\n${paymentData.error || '決済に失敗しました。後日支払いが可能です。'}`)
          }
        } catch (paymentError: any) {
          // エラーでもチェックアウトは完了しているので、警告メッセージを表示
          console.error('Payment error:', paymentError)
          setStatus('success')
          setMessage(`チェックアウトしました！（滞在時間: ${durationMinutes}分）\n※決済処理でエラーが発生しました。後日支払いが可能です。`)
        }
      } else {
        setStatus('success')
        setMessage(`チェックアウトしました！（滞在時間: ${durationMinutes}分）`)
      }

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
          className="absolute right-4 top-4 text-room-charcoal-light hover:text-room-charcoal"
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

