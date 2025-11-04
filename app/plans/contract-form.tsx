'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ContractFormProps {
  planId: string
  planName: string
  planFeatures?: any // プランのfeatures情報
  planData?: any // プランの全データ（available_days等を含む）
}

export function ContractForm({ planId, planName, planFeatures, planData }: ContractFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    // デフォルトは今日の日付
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  
  // オプションの状態管理
  const [options, setOptions] = useState({
    company_registration: false,  // 法人登記（+5,500円/月）- シェアオフィスプランのみ
    printer: false,                // プリンター（+1,100円/月）- ワークスペースプランのみ
    twenty_four_hours: false,      // 24時間利用（+5,500円/月）- 特定のプランのみ
    fixed_seat: false,             // 固定席化（+23,100円/月）- 全プラン
  })
  
  // プランの種類を判定
  const planType = planFeatures?.type // 'shared_office' or 'coworking'
  
  // 24時間利用オプションが利用可能か判定
  // 条件: 平日も土日も全部使えるプラン限定
  // シェアオフィスプラン：起業家プラン・レギュラープランのみ（ライトプランには付けられない）
  // ワークスペースプラン：フルタイムプランのみ
  const isTwentyFourHoursAvailable = () => {
    if (!planData?.available_days) return false
    
    const availableDays = planData.available_days as string[]
    const hasAllWeekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every(day => availableDays.includes(day))
    const hasWeekend = availableDays.includes('saturday') || availableDays.includes('sunday')
    
    if (planType === 'shared_office') {
      // 起業家プランまたはレギュラープラン（ライトプランは除外）
      return hasAllWeekdays && hasWeekend && planData.code !== 'light'
    } else if (planType === 'coworking') {
      // フルタイムプランのみ
      return planData.code === 'fulltime'
    }
    return false
  }
  
  // 利用可能なオプションを判定
  const availableOptions = {
    company_registration: planType === 'shared_office' && !planFeatures?.company_registration?.standard,
    printer: planType === 'coworking' && !planFeatures?.printer,
    twenty_four_hours: isTwentyFourHoursAvailable(),
    fixed_seat: true, // 全プランで利用可能
  }
  
  // 起業家プランの場合は法人登記は標準装備なので選択不可
  if (planFeatures?.company_registration?.standard) {
    availableOptions.company_registration = false
  }

  const handleContractClick = () => {
    setShowConfirm(true)
  }

  const handleConfirmCancel = () => {
    setShowConfirm(false)
  }

  const handleContract = async () => {
    setShowConfirm(false)

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('ログインが必要です')
        setLoading(false)
        return
      }

      // 既存のアクティブな契約をチェック
      const { data: existingPlan } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('ended_at', null)
        .single()

      // 既存の契約がある場合は終了日を設定（プラン変更）
      if (existingPlan) {
        const { error: updateError } = await supabase
          .from('user_plans')
          .update({
            ended_at: startDate,
            status: 'changed',
          })
          .eq('id', existingPlan.id)

        if (updateError) {
          console.error('Update existing plan error:', updateError)
          setError(`既存の契約の更新に失敗しました: ${updateError.message}`)
          setLoading(false)
          return
        }
      }

      // オプション情報を整理（選択されたオプションのみ）
      const selectedOptions: any = {}
      if (options.company_registration) selectedOptions.company_registration = true
      if (options.printer) selectedOptions.printer = true
      if (options.twenty_four_hours) selectedOptions.twenty_four_hours = true
      if (options.fixed_seat) selectedOptions.fixed_seat = true
      
      // 起業家プランの場合は法人登記を自動的に含める
      if (planFeatures?.company_registration?.standard) {
        selectedOptions.company_registration = true
      }
      
      // シェアオフィスプランの場合はプリンターを自動的に含める
      if (planFeatures?.printer === true) {
        selectedOptions.printer = true
      }

      // 新しいプラン契約を作成
      const { error: insertError } = await supabase
        .from('user_plans')
        .insert({
          user_id: user.id,
          plan_id: planId,
          started_at: startDate,
          status: 'active',
          options: selectedOptions,
        })

      if (insertError) {
        console.error('Contract insert error:', insertError)
        setError(`プラン契約に失敗しました: ${insertError.message}`)
        setLoading(false)
        return
      }

      // member_typeを'regular'に更新
      const { error: updateMemberTypeError } = await supabase
        .from('users')
        .update({
          member_type: 'regular',
        })
        .eq('id', user.id)

      if (updateMemberTypeError) {
        console.error('Update member_type error:', updateMemberTypeError)
        // member_typeの更新に失敗しても、プラン契約は成功しているので警告だけ
        console.warn('member_typeの更新に失敗しましたが、プラン契約は完了しました')
      }

      // 成功メッセージを表示してからリダイレクト
      setLoading(false)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Contract error:', err)
      setError('プラン契約中にエラーが発生しました')
      setLoading(false)
    }
  }

  // オプション料金を計算
  const calculateOptionPrice = () => {
    let total = 0
    if (options.company_registration && availableOptions.company_registration) total += 5500
    if (options.printer && availableOptions.printer) total += 1100
    if (options.twenty_four_hours) total += 5500
    if (options.fixed_seat) total += 23100
    return total
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <label htmlFor={`startDate-${planId}`} className="block text-xs font-medium text-room-charcoal mb-1">
            契約開始日
          </label>
          <input
            id={`startDate-${planId}`}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
          />
        </div>

        {/* オプション選択 */}
        {(availableOptions.company_registration || availableOptions.printer || availableOptions.twenty_four_hours || availableOptions.fixed_seat) && (
          <div>
            <label className="block text-xs font-medium text-room-charcoal mb-2">
              オプション（追加料金）
            </label>
            <div className="space-y-2">
              {availableOptions.company_registration && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.company_registration}
                    onChange={(e) => setOptions({ ...options, company_registration: e.target.checked })}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-xs text-room-charcoal">
                    法人登記 <span className="text-room-main">+¥5,500/月</span>
                  </span>
                </label>
              )}
              {availableOptions.printer && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.printer}
                    onChange={(e) => setOptions({ ...options, printer: e.target.checked })}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-xs text-room-charcoal">
                    プリンター <span className="text-room-main">+¥1,100/月</span>
                  </span>
                </label>
              )}
              {availableOptions.twenty_four_hours && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.twenty_four_hours}
                    onChange={(e) => setOptions({ ...options, twenty_four_hours: e.target.checked })}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-xs text-room-charcoal">
                    24時間利用 <span className="text-room-main">+¥5,500/月</span>
                  </span>
                </label>
              )}
              {availableOptions.fixed_seat && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.fixed_seat}
                    onChange={(e) => setOptions({ ...options, fixed_seat: e.target.checked })}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-xs text-room-charcoal">
                    固定席化 <span className="text-room-main">+¥23,100/月</span>
                  </span>
                </label>
              )}
            </div>
            {calculateOptionPrice() > 0 && (
              <p className="mt-2 text-xs text-room-main font-medium">
                オプション追加料金: +¥{calculateOptionPrice().toLocaleString()}/月
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-2">
            <p className="text-xs text-room-main-dark">{error}</p>
          </div>
        )}

        <button
          onClick={handleContractClick}
          disabled={loading || showConfirm}
          className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? '契約中...' : 'このプランで契約する'}
        </button>
      </div>

      {/* 確認モーダル */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-room-charcoal bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-room-base-light p-6 shadow-xl border-2 border-room-wood">
            <h3 className="text-lg font-bold text-room-charcoal mb-4">
              会員契約の確認
            </h3>
            <div className="text-sm text-room-charcoal mb-6 space-y-2">
              <p>
                「<span className="font-semibold">{planName}</span>」で会員契約を結びますか？
              </p>
              {calculateOptionPrice() > 0 && (
                <p className="text-xs text-room-main">
                  オプション追加料金: +¥{calculateOptionPrice().toLocaleString()}/月
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmCancel}
                disabled={loading}
                className="flex-1 rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal focus:outline-none focus:ring-2 focus:ring-room-charcoal focus:ring-offset-2 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleContract}
                disabled={loading}
                className="flex-1 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? '契約中...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

