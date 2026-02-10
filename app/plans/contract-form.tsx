'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ContractFormProps {
  planId: string
  planName: string
  planPrice: number // planTypeに応じた価格（workspace_price or shared_office_price）
  planType: 'workspace' | 'shared_office'
  planData?: any // プランの全データ（時間帯等を含む）
}

export function ContractForm({ planId, planName, planPrice, planType, planData }: ContractFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => {
    // デフォルトは今日の日付
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // 契約期間と支払い方法
  const [contractTerm, setContractTerm] = useState<'monthly' | 'yearly'>('monthly')
  const [paymentMethod, setPaymentMethod] = useState<'monthly' | 'annual_prepaid'>('monthly')

  // オプションの状態管理
  const [options, setOptions] = useState({
    company_registration: false,  // 法人登記（+5,500円/月）- シェアオフィスのみ
    printer: false,                // プリンター（+1,100円/月）- ワークスペースのみ（シェアオフィスは標準装備）
    twenty_four_hours: false,      // 24時間利用（+5,500円/月）- レギュラープランのみ
    fixed_seat: false,             // 固定席化（+23,100円/月）- 全プラン
    locker: false,                 // ロッカー（料金要確認）- 全プラン
    locker_size: null as 'large' | 'small' | null, // ロッカーのサイズ
  })

  // ロッカーの空き状況
  const [lockerInventory, setLockerInventory] = useState<{
    large: { available: number; total: number }
    small: { available: number; total: number }
  } | null>(null)

  // キャンペーン関連
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // 利用可能なオプションを判定
  const availableOptions = {
    company_registration: planType === 'shared_office',  // 法人登記: シェアオフィスのみ
    printer: planType === 'workspace',                   // プリンター: ワークスペースのみ（シェアオフィスは標準装備）
    twenty_four_hours: planData?.code === 'regular',     // 24時間: レギュラープランのみ
    fixed_seat: true, // 全プランで利用可能
    locker: true, // 全プランで利用可能
  }

  // ロッカーの空き状況を取得
  const fetchLockerInventory = async () => {
    const { data: lockers } = await supabase
      .from('lockers')
      .select('size, status')

    if (lockers) {
      const large = lockers.filter(l => l.size === 'large')
      const small = lockers.filter(l => l.size === 'small')
      const largeAvailable = large.filter(l => l.status === 'available').length
      const smallAvailable = small.filter(l => l.status === 'available').length

      setLockerInventory({
        large: { available: largeAvailable, total: large.length },
        small: { available: smallAvailable, total: small.length },
      })
    }
  }

  // コンポーネントマウント時に空き状況を取得
  useEffect(() => {
    if (availableOptions.locker) {
      fetchLockerInventory()
    }
  }, [availableOptions.locker])

  // キャンペーン一覧を取得
  useEffect(() => {
    const fetchCampaigns = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true)
        .lte('started_at', today)
        .or(`ended_at.is.null,ended_at.gte.${today}`)
        .order('created_at', { ascending: false })

      if (data) {
        // プランに適用可能なキャンペーンのみをフィルタリング
        const applicableCampaigns = data.filter((campaign) => {
          // 全プラン適用の場合
          if (!campaign.applicable_plan_ids || campaign.applicable_plan_ids.length === 0) {
            return true
          }
          // 特定プラン適用の場合
          return campaign.applicable_plan_ids.includes(planId)
        })
        setCampaigns(applicableCampaigns)

        // デフォルトで最初のキャンペーンを選択
        if (applicableCampaigns.length > 0) {
          setSelectedCampaignId(applicableCampaigns[0].id)
        }
      }
    }
    fetchCampaigns()
  }, [planId])

  const handleContractClick = () => {
    console.log('handleContractClick called', { planId, contractTerm, paymentMethod, startDate, options, selectedCampaignId })

    // 決済画面へ遷移（URLパラメータで契約情報を渡す）
    const params = new URLSearchParams({
      planId,
      planType,
      contractTerm,
      paymentMethod,
      startDate,
      options: encodeURIComponent(JSON.stringify(options)),
    })

    if (selectedCampaignId) {
      params.append('campaignId', selectedCampaignId)
    }

    const checkoutUrl = `/plans/checkout?${params.toString()}`
    console.log('Navigating to:', checkoutUrl)

    // window.location.hrefを使用して確実に遷移
    window.location.href = checkoutUrl
  }


  // ロッカーの料金（税込み、割引対象外）
  const LOCKER_PRICE_LARGE = 4950 // 大ロッカー: 月4,950円
  const LOCKER_PRICE_SMALL = 2200 // 小ロッカー: 月2,200円

  // 入会金（通常11,000円）
  const ENTRY_FEE = 11000

  // キャンペーンを取得
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)

  // 入会金を計算（キャンペーン適用）
  const calculateEntryFee = () => {
    if (!selectedCampaign) {
      return ENTRY_FEE
    }

    switch (selectedCampaign.campaign_type) {
      case 'entry_fee_free':
        return 0
      case 'entry_fee_50off':
        return Math.floor(ENTRY_FEE * 0.5)
      case 'entry_fee_custom':
        const discountRate = selectedCampaign.discount_rate || 0
        return Math.floor(ENTRY_FEE * (1 - discountRate / 100))
      default:
        return ENTRY_FEE
    }
  }

  // 初月の日割り計算
  const calculateFirstMonthProratedFee = () => {
    if (!startDate) return 0

    const start = new Date(startDate)
    const year = start.getFullYear()
    const month = start.getMonth()

    // その月の最終日を取得
    const lastDay = new Date(year, month + 1, 0).getDate()

    // 開始日から月末までの日数
    const daysInMonth = lastDay
    const daysFromStart = lastDay - start.getDate() + 1

    // 日割り計算（端数切り上げ）
    const monthlyPrice = calculatePlanPrice()
    const proratedFee = Math.ceil((monthlyPrice * daysFromStart) / daysInMonth)

    return proratedFee
  }

  // オプション料金を計算（割引対象外）
  const calculateOptionPrice = () => {
    let total = 0
    if (options.company_registration && availableOptions.company_registration) total += 5500
    if (options.printer && availableOptions.printer) total += 1100
    if (options.twenty_four_hours) total += 5500
    if (options.fixed_seat) total += 23100
    if (options.locker && options.locker_size) {
      // ロッカーの料金はサイズによって異なる（割引対象外）
      total += options.locker_size === 'large' ? LOCKER_PRICE_LARGE : LOCKER_PRICE_SMALL
    }
    return total
  }

  // プラン料金を計算（割引適用）
  const calculatePlanPrice = () => {
    let basePrice = planPrice

    // 長期契約割引（20%off）
    if (contractTerm === 'yearly') {
      basePrice = Math.floor(basePrice * 0.8)
    }

    // 年一括前払い割引（30%off）
    if (paymentMethod === 'annual_prepaid') {
      basePrice = Math.floor(basePrice * 0.7)
    }

    return basePrice
  }

  // 合計金額を計算
  const calculateTotalPrice = () => {
    const planPriceAfterDiscount = calculatePlanPrice()
    const optionPrice = calculateOptionPrice()
    const entryFee = calculateEntryFee()

    // 初月会費無料キャンペーンの場合
    const firstMonthFee = selectedCampaign?.campaign_type === 'first_month_free'
      ? 0
      : calculateFirstMonthProratedFee()

    // オプション料金は初月も日割り計算する必要があるが、簡略化のため月額で計算
    // （実際の実装ではオプションも日割り計算が必要）
    const firstMonthOptionPrice = selectedCampaign?.campaign_type === 'first_month_free'
      ? 0
      : optionPrice

    if (paymentMethod === 'annual_prepaid') {
      // 年一括前払いの場合：初月は日割り、残り11ヶ月は通常料金
      const remainingMonthsPrice = (planPriceAfterDiscount + optionPrice) * 11
      return entryFee + firstMonthFee + firstMonthOptionPrice + remainingMonthsPrice
    }

    // 月払いの場合：初月のみ日割り計算
    return entryFee + firstMonthFee + firstMonthOptionPrice
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

        {/* 契約期間と支払い方法 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-room-charcoal mb-2">
              契約期間
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`contract-term-${planId}`}
                  checked={contractTerm === 'monthly'}
                  onChange={() => setContractTerm('monthly')}
                  className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                />
                <span className="text-xs text-room-charcoal">
                  月契約（通常価格）
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`contract-term-${planId}`}
                  checked={contractTerm === 'yearly'}
                  onChange={() => setContractTerm('yearly')}
                  className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                />
                <span className="text-xs text-room-charcoal">
                  年契約（20%割引）
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-room-charcoal mb-2">
              支払い方法
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`payment-method-${planId}`}
                  checked={paymentMethod === 'monthly'}
                  onChange={() => setPaymentMethod('monthly')}
                  className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                />
                <span className="text-xs text-room-charcoal">
                  月払い
                </span>
              </label>
              {contractTerm === 'yearly' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`payment-method-${planId}`}
                    checked={paymentMethod === 'annual_prepaid'}
                    onChange={() => setPaymentMethod('annual_prepaid')}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-xs text-room-charcoal">
                    年一括前払い（30%割引）
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* キャンペーン表示 */}
        {campaigns.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-room-charcoal mb-2">
              適用中のキャンペーン
            </label>
            <div className="space-y-2">
              {campaigns.map((campaign) => {
                const isSelected = selectedCampaignId === campaign.id

                // キャンペーンごとのお得情報を計算
                let benefitText = ''
                if (campaign.campaign_type === 'entry_fee_free') {
                  benefitText = `入会金: 通常¥${ENTRY_FEE.toLocaleString()} → 無料`
                } else if (campaign.campaign_type === 'entry_fee_50off') {
                  const discountedFee = Math.floor(ENTRY_FEE * 0.5)
                  benefitText = `入会金: 通常¥${ENTRY_FEE.toLocaleString()} → ¥${discountedFee.toLocaleString()}`
                } else if (campaign.campaign_type === 'entry_fee_custom') {
                  const discountRate = campaign.discount_rate || 0
                  const discountedFee = Math.floor(ENTRY_FEE * (1 - discountRate / 100))
                  benefitText = `入会金: 通常¥${ENTRY_FEE.toLocaleString()} → ¥${discountedFee.toLocaleString()}`
                } else if (campaign.campaign_type === 'first_month_free') {
                  const firstMonthFee = calculateFirstMonthProratedFee()
                  benefitText = `初月会費: 通常¥${firstMonthFee.toLocaleString()} → 無料`
                }

                return (
                  <label key={campaign.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        // キャンペーンが1つの場合は常に選択状態を維持
                        if (campaigns.length === 1) {
                          setSelectedCampaignId(campaign.id)
                        } else {
                          setSelectedCampaignId(isSelected ? null : campaign.id)
                        }
                      }}
                      disabled={campaigns.length === 1}
                      className="rounded border-room-base-dark text-room-main focus:ring-room-main disabled:opacity-50"
                    />
                    <span className={`text-xs ${isSelected ? 'text-room-charcoal font-medium' : 'text-room-charcoal-light'}`}>
                      {benefitText}
                    </span>
                    {isSelected && (
                      <span className="text-xs text-room-main">✓ 適用中</span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* オプション選択 */}
        {(availableOptions.company_registration || availableOptions.printer || availableOptions.twenty_four_hours || availableOptions.fixed_seat || availableOptions.locker) && (
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
              {availableOptions.locker && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.locker}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setOptions({
                          ...options,
                          locker: checked,
                          locker_size: checked ? options.locker_size : null
                        })
                        if (checked) {
                          fetchLockerInventory()
                        }
                      }}
                      className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                    />
                    <span className="text-xs text-room-charcoal">
                      ロッカー <span className="text-room-main">(サイズ選択後に料金表示)</span>
                    </span>
                  </label>
                  {options.locker && lockerInventory && (
                    <div className="ml-6 space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`locker-size-${planId}`}
                          checked={options.locker_size === 'large'}
                          onChange={() => setOptions({ ...options, locker_size: 'large' })}
                          disabled={lockerInventory.large.available === 0}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main disabled:opacity-50"
                        />
                        <span className={`text-xs ${lockerInventory.large.available === 0 ? 'text-room-charcoal-light' : 'text-room-charcoal'}`}>
                          大ロッカー <span className="text-room-main">+¥{LOCKER_PRICE_LARGE.toLocaleString()}/月</span> {lockerInventory.large.available > 0 ? (
                            <span className="text-room-main">(空き{lockerInventory.large.available}個)</span>
                          ) : (
                            <span className="text-red-600">(満室)</span>
                          )}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`locker-size-${planId}`}
                          checked={options.locker_size === 'small'}
                          onChange={() => setOptions({ ...options, locker_size: 'small' })}
                          disabled={lockerInventory.small.available === 0}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main disabled:opacity-50"
                        />
                        <span className={`text-xs ${lockerInventory.small.available === 0 ? 'text-room-charcoal-light' : 'text-room-charcoal'}`}>
                          小ロッカー <span className="text-room-main">+¥{LOCKER_PRICE_SMALL.toLocaleString()}/月</span> {lockerInventory.small.available > 0 ? (
                            <span className="text-room-main">(空き{lockerInventory.small.available}個)</span>
                          ) : (
                            <span className="text-red-600">(満室)</span>
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 料金サマリー */}
        <div className="rounded-md bg-room-base-dark p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-room-charcoal">プラン料金:</span>
            <span className="text-room-charcoal">
              {contractTerm === 'yearly' || paymentMethod === 'annual_prepaid' ? (
                <>
                  <span className="line-through text-room-charcoal-light">¥{planPrice.toLocaleString()}</span>{' '}
                  ¥{calculatePlanPrice().toLocaleString()}
                  {paymentMethod === 'annual_prepaid' && <span className="text-room-main">/月（30%割引）</span>}
                  {contractTerm === 'yearly' && paymentMethod === 'monthly' && <span className="text-room-main">/月（20%割引）</span>}
                </>
              ) : (
                <>¥{planPrice.toLocaleString()}/月</>
              )}
            </span>
          </div>
          {calculateOptionPrice() > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-room-charcoal">オプション料金（割引対象外）:</span>
              <span className="text-room-charcoal">+¥{calculateOptionPrice().toLocaleString()}/月</span>
            </div>
          )}
          {/* 入会金 */}
          <div className="flex justify-between text-xs">
            <span className="text-room-charcoal">入会金:</span>
            <span className="text-room-charcoal">
              {calculateEntryFee() < ENTRY_FEE ? (
                <>
                  <span className="line-through text-room-charcoal-light">¥{ENTRY_FEE.toLocaleString()}</span>{' '}
                  ¥{calculateEntryFee().toLocaleString()}
                  {selectedCampaign && (
                    <span className="text-room-main">（キャンペーン適用）</span>
                  )}
                </>
              ) : (
                <>¥{ENTRY_FEE.toLocaleString()}</>
              )}
            </span>
          </div>
          {/* 初月会費 */}
          {paymentMethod === 'monthly' && (
            <div className="flex justify-between text-xs">
              <span className="text-room-charcoal">初月会費（日割り計算）:</span>
              <span className="text-room-charcoal">
                {selectedCampaign?.campaign_type === 'first_month_free' ? (
                  <>
                    <span className="line-through text-room-charcoal-light">¥{calculateFirstMonthProratedFee().toLocaleString()}</span>{' '}
                    <span className="text-room-main">¥0（キャンペーン適用）</span>
                  </>
                ) : (
                  <>¥{calculateFirstMonthProratedFee().toLocaleString()}</>
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-room-base">
            <span className="text-room-charcoal">
              {paymentMethod === 'annual_prepaid' ? '年一括前払い' : '初回'}合計:
            </span>
            <span className="text-room-main">
              ¥{calculateTotalPrice().toLocaleString()}
              {paymentMethod === 'annual_prepaid' && <span className="text-xs font-normal">（入会金+初月日割り+11ヶ月分）</span>}
              {paymentMethod === 'monthly' && <span className="text-xs font-normal">（入会金+初月日割り）</span>}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-2">
            <p className="text-xs text-room-main-dark">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleContractClick}
          disabled={loading}
          className="w-full rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? '読み込み中...' : '決済に進む'}
        </button>
      </div>
    </>
  )
}
