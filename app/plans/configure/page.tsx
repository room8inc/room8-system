'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    }>
      <ConfigurePageContent />
    </Suspense>
  )
}

function ConfigurePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const planId = searchParams.get('planId')

  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Step管理（1: 住所利用, 2: オプション+契約詳細）
  const [step, setStep] = useState(1)

  // 住所利用（シェアオフィス）の選択
  const [useSharedOffice, setUseSharedOffice] = useState<boolean | null>(null)

  // オプション
  const [options, setOptions] = useState({
    company_registration: false,
    printer: false,
    twenty_four_hours: false,
    locker: false,
    locker_size: null as 'large' | 'small' | null,
  })

  // 契約設定
  const [contractTerm, setContractTerm] = useState<'monthly' | 'yearly'>('monthly')
  const [paymentMethod, setPaymentMethod] = useState<'monthly' | 'annual_prepaid'>('monthly')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])

  // キャンペーン
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // ロッカー空き
  const [lockerInventory, setLockerInventory] = useState<{
    large: { available: number; total: number }
    small: { available: number; total: number }
  } | null>(null)

  // 料金定数
  const SHARED_OFFICE_PRICE = 3300
  const LOCKER_PRICE_LARGE = 4950
  const LOCKER_PRICE_SMALL = 2750
  const ENTRY_FEE = 11000

  // プラン情報を取得
  useEffect(() => {
    if (!planId) {
      setError('プランが指定されていません')
      setLoading(false)
      return
    }

    const fetchPlan = async () => {
      const { data, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (planError || !data) {
        setError('プラン情報の取得に失敗しました')
      } else {
        setPlan(data)
      }
      setLoading(false)
    }
    fetchPlan()
  }, [planId])

  // キャンペーン取得
  useEffect(() => {
    if (!planId) return
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
        const applicable = data.filter((c) => {
          if (!c.applicable_plan_ids || c.applicable_plan_ids.length === 0) return true
          return c.applicable_plan_ids.includes(planId)
        })
        setCampaigns(applicable)
        if (applicable.length > 0) setSelectedCampaignId(applicable[0].id)
      }
    }
    fetchCampaigns()
  }, [planId])

  // ロッカー空き取得
  const fetchLockerInventory = async () => {
    const { data: lockers } = await supabase
      .from('lockers')
      .select('size, status')
    if (lockers) {
      const large = lockers.filter(l => l.size === 'large')
      const small = lockers.filter(l => l.size === 'small')
      setLockerInventory({
        large: { available: large.filter(l => l.status === 'available').length, total: large.length },
        small: { available: small.filter(l => l.status === 'available').length, total: small.length },
      })
    }
  }

  // 利用可能なオプション
  const availableOptions = {
    company_registration: useSharedOffice === true,
    printer: useSharedOffice !== true,
    twenty_four_hours: plan?.code === 'fulltime',
    locker: true,
  }

  // 料金計算
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)

  const calculatePlanPrice = () => {
    let base = plan?.workspace_price || 0
    if (contractTerm === 'yearly') base = Math.floor(base * 0.8)
    if (paymentMethod === 'annual_prepaid') base = Math.floor(base * 0.7)
    return base
  }

  const calculateOptionPrice = () => {
    let total = 0
    if (useSharedOffice) total += SHARED_OFFICE_PRICE
    if (options.company_registration && availableOptions.company_registration) total += 5500
    if (options.printer && availableOptions.printer) total += 1100
    if (options.twenty_four_hours && availableOptions.twenty_four_hours) total += 5500
    if (options.locker && options.locker_size) {
      total += options.locker_size === 'large' ? LOCKER_PRICE_LARGE : LOCKER_PRICE_SMALL
    }
    return total
  }

  const calculateEntryFee = () => {
    if (!selectedCampaign) return ENTRY_FEE
    switch (selectedCampaign.campaign_type) {
      case 'entry_fee_free': return 0
      case 'entry_fee_50off': return Math.floor(ENTRY_FEE * 0.5)
      case 'entry_fee_custom':
        return Math.floor(ENTRY_FEE * (1 - (selectedCampaign.discount_rate || 0) / 100))
      default: return ENTRY_FEE
    }
  }

  const calculateFirstMonthFee = () => {
    if (!startDate) return 0
    const start = new Date(startDate)
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    const daysFromStart = lastDay - start.getDate() + 1
    const monthlyPrice = calculatePlanPrice()
    return Math.ceil((monthlyPrice * daysFromStart) / lastDay)
  }

  const calculateTotalPrice = () => {
    const planPrice = calculatePlanPrice()
    const optionPrice = calculateOptionPrice()
    const entryFee = calculateEntryFee()
    const firstMonthFee = selectedCampaign?.campaign_type === 'first_month_free' ? 0 : calculateFirstMonthFee()
    const firstMonthOptionPrice = selectedCampaign?.campaign_type === 'first_month_free' ? 0 : optionPrice

    if (paymentMethod === 'annual_prepaid') {
      return entryFee + firstMonthFee + firstMonthOptionPrice + (planPrice + optionPrice) * 11
    }
    return entryFee + firstMonthFee + firstMonthOptionPrice
  }

  // 決済に進む
  const handleCheckout = () => {
    const planType = useSharedOffice ? 'shared_office' : 'workspace'
    const allOptions = {
      shared_office: useSharedOffice || false,
      ...options,
    }
    const params = new URLSearchParams({
      planId: planId!,
      planType,
      contractTerm,
      paymentMethod,
      startDate,
      options: encodeURIComponent(JSON.stringify(allOptions)),
    })
    if (selectedCampaignId) params.append('campaignId', selectedCampaignId)
    window.location.href = `/plans/checkout?${params.toString()}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-room-main-dark mb-4">{error || 'プラン情報が見つかりません'}</p>
          <Link href="/plans" className="text-room-main hover:text-room-main-light">
            プラン選択に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/plans"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← 時間帯の選択に戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-room-charcoal">
            {plan.name}
          </h1>
          <p className="text-sm text-room-charcoal-light mt-1">
            ¥{plan.workspace_price?.toLocaleString()}/月〜
          </p>
        </div>

        {/* ===== Step 1: 住所利用の選択 ===== */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-room-charcoal mb-4">
            住所利用は必要ですか？
          </h2>
          <div className="space-y-3">
            {/* 不要（ワークスペース） */}
            <button
              onClick={() => {
                setUseSharedOffice(false)
                setOptions({ ...options, company_registration: false })
                setStep(2)
              }}
              className={`w-full text-left rounded-lg border-2 p-5 transition-all ${
                useSharedOffice === false
                  ? 'border-room-main bg-room-main bg-opacity-5'
                  : 'border-room-base-dark bg-room-base-light hover:border-room-main'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-room-charcoal">不要（ワークスペース）</p>
                  <p className="text-xs text-room-charcoal-light mt-1">
                    席を使って仕事ができるシンプルなプラン
                  </p>
                </div>
                <p className="text-lg font-bold text-room-main">
                  ¥{plan.workspace_price?.toLocaleString()}<span className="text-xs font-normal">/月</span>
                </p>
              </div>
            </button>

            {/* 必要（シェアオフィス） */}
            <button
              onClick={() => {
                setUseSharedOffice(true)
                setOptions({ ...options, printer: false })
                setStep(2)
              }}
              className={`w-full text-left rounded-lg border-2 p-5 transition-all ${
                useSharedOffice === true
                  ? 'border-room-main bg-room-main bg-opacity-5'
                  : 'border-room-base-dark bg-room-base-light hover:border-room-main'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-room-charcoal">必要（シェアオフィス）</p>
                  <p className="text-xs text-room-charcoal-light mt-1">
                    住所利用 + 便利な特典付き
                  </p>
                </div>
                <p className="text-lg font-bold text-room-main">
                  ¥{plan.shared_office_price?.toLocaleString()}<span className="text-xs font-normal">/月</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-room-charcoal-light">
                <p>✓ 住所利用（名刺・HP掲載OK）</p>
                <p>✓ 郵便物受取</p>
                <p>✓ 来客対応</p>
                <p>✓ 会議室 月4h無料</p>
                <p>✓ プリンター標準装備</p>
              </div>
            </button>
          </div>
        </div>

        {/* ===== Step 2: オプション + 契約詳細 ===== */}
        {step >= 2 && useSharedOffice !== null && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* 追加オプション */}
            {(availableOptions.company_registration || availableOptions.printer || availableOptions.twenty_four_hours) && (
              <div>
                <h2 className="text-lg font-bold text-room-charcoal mb-4">
                  追加オプション
                </h2>
                <div className="space-y-3">
                  {/* 法人登記（シェアオフィスのみ） */}
                  {availableOptions.company_registration && (
                    <label className="flex items-center justify-between rounded-lg border-2 border-room-base-dark bg-room-base-light p-4 cursor-pointer hover:border-room-main transition-all">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={options.company_registration}
                          onChange={(e) => setOptions({ ...options, company_registration: e.target.checked })}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main h-5 w-5"
                        />
                        <div>
                          <p className="font-medium text-room-charcoal">法人登記</p>
                          <p className="text-xs text-room-charcoal-light">Room8の住所で法人登記が可能</p>
                        </div>
                      </div>
                      <p className="font-bold text-room-main">+¥5,500/月</p>
                    </label>
                  )}

                  {/* プリンター（ワークスペースのみ） */}
                  {availableOptions.printer && (
                    <label className="flex items-center justify-between rounded-lg border-2 border-room-base-dark bg-room-base-light p-4 cursor-pointer hover:border-room-main transition-all">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={options.printer}
                          onChange={(e) => setOptions({ ...options, printer: e.target.checked })}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main h-5 w-5"
                        />
                        <div>
                          <p className="font-medium text-room-charcoal">プリンター使い放題</p>
                          <p className="text-xs text-room-charcoal-light">コピー・スキャンも利用可能</p>
                        </div>
                      </div>
                      <p className="font-bold text-room-main">+¥1,100/月</p>
                    </label>
                  )}

                  {/* 24時間（レギュラーのみ） */}
                  {availableOptions.twenty_four_hours && (
                    <label className="flex items-center justify-between rounded-lg border-2 border-room-base-dark bg-room-base-light p-4 cursor-pointer hover:border-room-main transition-all">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={options.twenty_four_hours}
                          onChange={(e) => setOptions({ ...options, twenty_four_hours: e.target.checked })}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main h-5 w-5"
                        />
                        <div>
                          <p className="font-medium text-room-charcoal">24時間利用</p>
                          <p className="text-xs text-room-charcoal-light">営業時間外も利用可能</p>
                        </div>
                      </div>
                      <p className="font-bold text-room-main">+¥5,500/月</p>
                    </label>
                  )}

                  {/* ロッカー */}
                  <div>
                    <label className="flex items-center justify-between rounded-lg border-2 border-room-base-dark bg-room-base-light p-4 cursor-pointer hover:border-room-main transition-all">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={options.locker}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setOptions({ ...options, locker: checked, locker_size: checked ? options.locker_size : null })
                            if (checked) fetchLockerInventory()
                          }}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main h-5 w-5"
                        />
                        <div>
                          <p className="font-medium text-room-charcoal">ロッカー</p>
                          <p className="text-xs text-room-charcoal-light">私物を保管できるロッカー</p>
                        </div>
                      </div>
                      <p className="text-sm text-room-charcoal-light">サイズを選択</p>
                    </label>
                    {options.locker && lockerInventory && (
                      <div className="mt-2 ml-4 space-y-2">
                        <label className="flex items-center justify-between rounded-lg border border-room-base-dark bg-room-base p-3 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="locker-size"
                              checked={options.locker_size === 'large'}
                              onChange={() => setOptions({ ...options, locker_size: 'large' })}
                              disabled={lockerInventory.large.available === 0}
                              className="text-room-main focus:ring-room-main"
                            />
                            <span className={`text-sm ${lockerInventory.large.available === 0 ? 'text-room-charcoal-light' : 'text-room-charcoal'}`}>
                              大ロッカー {lockerInventory.large.available > 0
                                ? <span className="text-room-main text-xs">(空き{lockerInventory.large.available}個)</span>
                                : <span className="text-red-600 text-xs">(満室)</span>}
                            </span>
                          </div>
                          <span className="font-bold text-room-main">+¥{LOCKER_PRICE_LARGE.toLocaleString()}/月</span>
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-room-base-dark bg-room-base p-3 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="locker-size"
                              checked={options.locker_size === 'small'}
                              onChange={() => setOptions({ ...options, locker_size: 'small' })}
                              disabled={lockerInventory.small.available === 0}
                              className="text-room-main focus:ring-room-main"
                            />
                            <span className={`text-sm ${lockerInventory.small.available === 0 ? 'text-room-charcoal-light' : 'text-room-charcoal'}`}>
                              小ロッカー {lockerInventory.small.available > 0
                                ? <span className="text-room-main text-xs">(空き{lockerInventory.small.available}個)</span>
                                : <span className="text-red-600 text-xs">(満室)</span>}
                            </span>
                          </div>
                          <span className="font-bold text-room-main">+¥{LOCKER_PRICE_SMALL.toLocaleString()}/月</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 契約設定 */}
            <div>
              <h2 className="text-lg font-bold text-room-charcoal mb-4">
                契約設定
              </h2>
              <div className="space-y-4 rounded-lg border-2 border-room-base-dark bg-room-base-light p-5">
                {/* 開始日 */}
                <div>
                  <label className="block text-sm font-medium text-room-charcoal mb-1">契約開始日</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                  />
                </div>

                {/* 契約期間 */}
                <div>
                  <label className="block text-sm font-medium text-room-charcoal mb-2">契約期間</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setContractTerm('monthly')}
                      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        contractTerm === 'monthly'
                          ? 'bg-room-main text-white'
                          : 'bg-room-base border border-room-base-dark text-room-charcoal hover:border-room-main'
                      }`}
                    >
                      月契約
                    </button>
                    <button
                      onClick={() => setContractTerm('yearly')}
                      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        contractTerm === 'yearly'
                          ? 'bg-room-main text-white'
                          : 'bg-room-base border border-room-base-dark text-room-charcoal hover:border-room-main'
                      }`}
                    >
                      年契約（20%割引）
                    </button>
                  </div>
                </div>

                {/* 支払い方法 */}
                <div>
                  <label className="block text-sm font-medium text-room-charcoal mb-2">支払い方法</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentMethod('monthly')}
                      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        paymentMethod === 'monthly'
                          ? 'bg-room-main text-white'
                          : 'bg-room-base border border-room-base-dark text-room-charcoal hover:border-room-main'
                      }`}
                    >
                      月払い
                    </button>
                    {contractTerm === 'yearly' && (
                      <button
                        onClick={() => setPaymentMethod('annual_prepaid')}
                        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                          paymentMethod === 'annual_prepaid'
                            ? 'bg-room-main text-white'
                            : 'bg-room-base border border-room-base-dark text-room-charcoal hover:border-room-main'
                        }`}
                      >
                        年一括（30%割引）
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* キャンペーン */}
            {campaigns.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-room-charcoal mb-4">キャンペーン</h2>
                <div className="space-y-2">
                  {campaigns.map((campaign) => {
                    const isSelected = selectedCampaignId === campaign.id
                    let benefitText = ''
                    if (campaign.campaign_type === 'entry_fee_free') {
                      benefitText = `入会金 ¥${ENTRY_FEE.toLocaleString()} → 無料`
                    } else if (campaign.campaign_type === 'entry_fee_50off') {
                      benefitText = `入会金 ¥${ENTRY_FEE.toLocaleString()} → ¥${Math.floor(ENTRY_FEE * 0.5).toLocaleString()}`
                    } else if (campaign.campaign_type === 'entry_fee_custom') {
                      const rate = campaign.discount_rate || 0
                      benefitText = `入会金 ¥${ENTRY_FEE.toLocaleString()} → ¥${Math.floor(ENTRY_FEE * (1 - rate / 100)).toLocaleString()}`
                    } else if (campaign.campaign_type === 'first_month_free') {
                      benefitText = `初月会費 → 無料`
                    }
                    return (
                      <label key={campaign.id} className="flex items-center gap-3 rounded-lg border border-room-base-dark bg-room-base-light p-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedCampaignId(isSelected ? null : campaign.id)}
                          disabled={campaigns.length === 1}
                          className="rounded border-room-base-dark text-room-main focus:ring-room-main h-5 w-5"
                        />
                        <span className={`text-sm ${isSelected ? 'text-room-charcoal font-medium' : 'text-room-charcoal-light'}`}>
                          {benefitText}
                        </span>
                        {isSelected && <span className="text-xs text-room-main ml-auto">適用中</span>}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 料金サマリー */}
            <div className="rounded-lg border-2 border-room-main bg-room-base-light p-5 space-y-2">
              <h2 className="text-lg font-bold text-room-charcoal mb-3">料金</h2>
              <div className="flex justify-between text-sm">
                <span className="text-room-charcoal">プラン料金</span>
                <span className="text-room-charcoal">
                  {contractTerm === 'yearly' || paymentMethod === 'annual_prepaid' ? (
                    <>
                      <span className="line-through text-room-charcoal-light mr-1">¥{plan.workspace_price?.toLocaleString()}</span>
                      ¥{calculatePlanPrice().toLocaleString()}/月
                    </>
                  ) : (
                    <>¥{plan.workspace_price?.toLocaleString()}/月</>
                  )}
                </span>
              </div>
              {calculateOptionPrice() > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-room-charcoal">オプション</span>
                  <span className="text-room-charcoal">+¥{calculateOptionPrice().toLocaleString()}/月</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-room-charcoal">入会金</span>
                <span className="text-room-charcoal">
                  {calculateEntryFee() < ENTRY_FEE ? (
                    <>
                      <span className="line-through text-room-charcoal-light mr-1">¥{ENTRY_FEE.toLocaleString()}</span>
                      ¥{calculateEntryFee().toLocaleString()}
                    </>
                  ) : (
                    <>¥{ENTRY_FEE.toLocaleString()}</>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-room-charcoal">初月会費（日割り）</span>
                <span className="text-room-charcoal">
                  {selectedCampaign?.campaign_type === 'first_month_free'
                    ? <><span className="line-through text-room-charcoal-light mr-1">¥{calculateFirstMonthFee().toLocaleString()}</span>¥0</>
                    : <>¥{calculateFirstMonthFee().toLocaleString()}</>
                  }
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t border-room-base-dark">
                <span className="text-room-charcoal">
                  {paymentMethod === 'annual_prepaid' ? '年一括' : '初回'}合計
                </span>
                <span className="text-room-main">¥{calculateTotalPrice().toLocaleString()}</span>
              </div>
            </div>

            {/* 決済ボタン */}
            <button
              onClick={handleCheckout}
              className="w-full rounded-lg bg-room-main px-6 py-4 text-lg font-bold text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 transition-all"
            >
              決済に進む
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
