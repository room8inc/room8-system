'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
// @ts-ignore - html5-qrcodeの型定義が不完全な場合があるため
import { Html5Qrcode } from 'html5-qrcode'
import { createClient } from '@/lib/supabase/client'
import { getActiveGroupMembership, findAvailableGroupSlot } from '@/lib/utils/group-plans'

export default function CheckInPage() {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'checking-in' | 'checking-out' | 'success'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const qrCodeRegionId = 'qr-reader'
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  const supabase = createClient()

  // コンポーネントのアンマウント時にスキャナーをクリーンアップ
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current?.clear()
          })
          .catch(() => {
            // エラーは無視
          })
      }
    }
  }, [])

  const startScanning = async () => {
    setError(null)
    setStatus('idle')
    setMessage(null)

    try {
      // カメラアクセス許可確認
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop()) // 一度停止してからhtml5-qrcodeに渡す

      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' }, // バックカメラ優先
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // QRコード読み取り成功
          await handleQRCodeScanned(decodedText)
        },
        () => {
          // 読み取りエラー（継続的に呼ばれる）
          // エラーは表示しない
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
    // スキャン停止
    await stopScanning()

    // 会場IDのバリデーション（基本的なチェック）
    if (!venueId || venueId.trim() === '') {
      setError('無効なQRコードです')
      return
    }

    // 現在のチェックイン状態を確認
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('ログインが必要です')
      router.push('/login')
      return
    }

    // 現在チェックイン中かどうかを確認
    const { data: currentCheckin, error: checkinError } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id)
      .is('checkout_at', null)
      .order('checkin_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkinError && checkinError.code !== 'PGRST116') {
      // PGRST116は「結果が見つからない」エラー（チェックインしていない状態）
      console.error('Checkin check error:', checkinError)
      setError('チェックイン状態の確認に失敗しました')
      return
    }

    if (currentCheckin) {
      // チェックアウト処理
      await handleCheckout(currentCheckin.id, venueId)
    } else {
      // チェックイン処理
      await handleCheckin(venueId)
    }
  }

  const handleCheckin = async (venueId: string) => {
    setStatus('checking-in')
    setMessage('チェックイン中...')
    setError(null)

    try {
      // ユーザー認証確認
      const { data: { user }, error: userAuthError } = await supabase.auth.getUser()
      
      if (userAuthError) {
        console.error('Auth error:', userAuthError)
        throw new Error(`認証エラー: ${userAuthError.message}`)
      }

      if (!user) {
        throw new Error('ログインが必要です。再度ログインしてください。')
      }

      console.log('User authenticated:', user.id)

      // ユーザー情報を取得
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_staff')
        .eq('id', user.id)
        .single()

      if (userError) {
        console.error('User data fetch error:', userError)
        throw new Error(`ユーザー情報の取得に失敗しました: ${userError.message}`)
      }

      console.log('User data:', userData)

      // 利用者の場合、staff_member_idと法人ユーザーIDを取得
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
          console.log('Staff member found:', {
            staffMemberId,
            planOwnerUserId,
          })
        }
      }

      // グループメンバーシップ確認
      let groupPlanId: string | null = null
      let groupSlotId: string | null = null
      let groupPlanIdAtCheckin: string | null = null

      const groupMembership = await getActiveGroupMembership(supabase, user.id)
      if (groupMembership) {
        const availableSlot = await findAvailableGroupSlot(
          supabase, groupMembership.group_plan_id, new Date()
        )

        if (availableSlot) {
          groupPlanId = groupMembership.group_plan_id
          groupSlotId = availableSlot.id
          groupPlanIdAtCheckin = availableSlot.plan_id
          console.log('Group slot found:', { groupPlanId, groupSlotId, groupPlanIdAtCheckin })
        } else {
          throw new Error('グループの同時利用上限に達しているか、現在の時間帯で利用可能なスロットがありません')
        }
      }

      // プラン契約の有無を確認（グループでない場合のみ）
      let planIdAtCheckin: string | null = groupPlanIdAtCheckin
      let memberTypeAtCheckin: 'regular' | 'dropin' = groupPlanId ? 'regular' : 'dropin'

      if (!groupPlanId) {
        const { data: activePlan, error: activePlanError } = await supabase
          .from('user_plans')
          .select('plan_id')
          .eq('user_id', planOwnerUserId)
          .eq('status', 'active')
          .is('ended_at', null)
          .maybeSingle()

        if (activePlanError && activePlanError.code !== 'PGRST116') {
          console.warn('Active plan fetch warning:', activePlanError)
        } else if (activePlan?.plan_id) {
          planIdAtCheckin = activePlan.plan_id
          memberTypeAtCheckin = 'regular'
          console.log('Active plan found:', {
            planIdAtCheckin,
            planOwnerUserId,
          })
        }
      }

      // チェックイン記録を挿入
      const checkinData = {
        user_id: user.id,
        checkin_at: new Date().toISOString(),
        venue_id: venueId,
        member_type_at_checkin: memberTypeAtCheckin,
        ...(planIdAtCheckin && { plan_id_at_checkin: planIdAtCheckin }),
        ...(staffMemberId && { staff_member_id: staffMemberId }),
        ...(groupPlanId && { group_plan_id: groupPlanId }),
        ...(groupSlotId && { group_slot_id: groupSlotId }),
      }

      console.log('Inserting checkin data:', checkinData)

      const { data: insertedCheckin, error: insertError } = await supabase
        .from('checkins')
        .insert(checkinData)
        .select()
        .single()

      if (insertError) {
        console.error('Checkin insert error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        })
        
        // RLSポリシーエラーの場合は詳細なメッセージを表示
        if (insertError.code === '42501' || insertError.message.includes('row-level security')) {
          throw new Error(`権限エラー: チェックインの権限がありません。RLSポリシーを確認してください。詳細: ${insertError.message}`)
        }
        
        throw new Error(`チェックインに失敗しました: ${insertError.message} (コード: ${insertError.code})`)
      }

      console.log('Checkin successful:', insertedCheckin)

      setStatus('success')
      setMessage('チェックインしました！')
      
      // 3秒後にダッシュボードにリダイレクト
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 3000)
    } catch (err) {
      console.error('Checkin error:', err)
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'チェックインに失敗しました。ブラウザのコンソールを確認してください。'
      setError(errorMessage)
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

      // チェックイン情報を取得
      const { data: checkinData, error: fetchError } = await supabase
        .from('checkins')
        .select('checkin_at')
        .eq('id', checkinId)
        .single()

      if (fetchError || !checkinData) {
        throw new Error('チェックイン情報の取得に失敗しました')
      }

      // 利用時間を計算
      const checkinAt = new Date(checkinData.checkin_at)
      const checkoutAt = new Date()
      const durationMinutes = Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / (1000 * 60))

      // 5分以内のチェックアウトはチェックインをキャンセル（削除）する
      if (durationMinutes < 5) {
        // 座席チェックアウトを先に実行（外部キー制約のため）
        const { error: seatDeleteError } = await supabase
          .from('seat_checkins')
          .delete()
          .eq('checkin_id', checkinId)

        if (seatDeleteError) {
          console.warn('Seat checkin delete error (non-blocking):', seatDeleteError)
        }

        // チェックインを削除
        const { data: deleteData, error: deleteError } = await supabase
          .from('checkins')
          .delete()
          .eq('id', checkinId)
          .select()

        if (deleteError) {
          console.error('Checkin cancel error:', deleteError)
          throw new Error(`チェックインのキャンセルに失敗しました: ${deleteError.message}`)
        }

        // 削除が成功したことを確認
        if (!deleteData || deleteData.length === 0) {
          console.warn('Checkin was not found or already deleted:', checkinId)
        }

        setStatus('success')
        setMessage('チェックインをキャンセルしました（5分以内のため）')
        
        // ダッシュボードにリダイレクト（ページをリフレッシュ）
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 2000)
        return
      }

      // チェックアウト記録を更新
      const { error: updateError } = await supabase
        .from('checkins')
        .update({
          checkout_at: checkoutAt.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', checkinId)

      if (updateError) {
        console.error('Checkout update error:', updateError)
        throw new Error(`チェックアウトに失敗しました: ${updateError.message}`)
      }

      // 座席チェックアウトを自動実行（会場チェックアウト時に座席も自動解除）
      const { error: seatCheckoutError } = await supabase
        .from('seat_checkins')
        .update({
          checkout_at: checkoutAt.toISOString(),
        })
        .eq('checkin_id', checkinId)
        .is('checkout_at', null)

      if (seatCheckoutError) {
        // 座席チェックアウトのエラーは警告として記録するが、会場チェックアウトは成功とする
        console.warn('Seat checkout error (non-blocking):', seatCheckoutError)
      }

      setStatus('success')
      setMessage(`チェックアウトしました！（滞在時間: ${durationMinutes}分）`)
      
      // 3秒後にダッシュボードにリダイレクト
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'チェックアウトに失敗しました')
      setStatus('idle')
      setMessage(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">チェックイン/チェックアウト</h1>
          <p className="mt-2 text-sm text-gray-600">
            会場のQRコードを読み取ってください
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {status === 'success' && message && (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div id={qrCodeRegionId} className="aspect-square w-full rounded-lg bg-gray-100"></div>
        </div>

        <div className="flex flex-col gap-3">
          {!scanning ? (
            <button
              onClick={startScanning}
              disabled={status === 'checking-in' || status === 'checking-out'}
              className="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              QRコードをスキャン
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="w-full rounded-md bg-red-600 px-4 py-3 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              スキャンを停止
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-md bg-gray-600 px-4 py-3 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            ダッシュボードに戻る
          </button>
        </div>

        {(status === 'checking-in' || status === 'checking-out') && message && (
          <div className="text-center">
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

