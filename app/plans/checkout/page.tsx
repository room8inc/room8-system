'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// 動的レンダリングを強制（Edge Runtimeエラーを回避）
export const dynamic = 'force-dynamic'

// Stripe公開キーを読み込み（環境変数から）
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

// 決済フォームコンポーネント
function CheckoutForm({
  planId,
  planName,
  contractTerm,
  paymentMethod,
  options,
  startDate,
  campaignId,
  entryFee,
  firstMonthFee,
  optionPrice,
  totalPrice,
  hasPaymentMethod,
  paymentMethodInfo,
  onPaymentWithSavedCard,
}: {
  planId: string
  planName: string
  contractTerm: 'monthly' | 'yearly'
  paymentMethod: 'monthly' | 'annual_prepaid'
  options: any
  startDate: string
  campaignId: string | null
  entryFee: number
  firstMonthFee: number
  optionPrice: number
  totalPrice: number
  hasPaymentMethod: boolean | null
  paymentMethodInfo: any
  onPaymentWithSavedCard: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || isProcessing) {
      return
    }

    // 重複送信を防ぐ
    setIsProcessing(true)
    setLoading(true)
    setError(null)

    try {
      // Payment Intentを作成
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          contractTerm,
          paymentMethod,
          options,
          startDate,
          campaignId,
          entryFee,
          firstMonthFee,
          optionPrice,
          totalPrice,
        }),
      })

      const { clientSecret, error: apiError } = await response.json()

      if (apiError || !clientSecret) {
        setError(apiError || '決済の準備に失敗しました')
        setLoading(false)
        setIsProcessing(false)
        return
      }

      // カード情報を確認
      const cardNumberElement = elements.getElement(CardNumberElement)
      const cardExpiryElement = elements.getElement(CardExpiryElement)
      const cardCvcElement = elements.getElement(CardCvcElement)
      
      if (!cardNumberElement || !cardExpiryElement || !cardCvcElement) {
        setError('カード情報が見つかりません')
        setLoading(false)
        return
      }

      // 決済を実行
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        },
      })

      if (confirmError) {
        setError(confirmError.message || '決済に失敗しました')
        setLoading(false)
        setIsProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        // 決済成功後、契約を確定
        const contractResponse = await fetch('/api/plans/complete-contract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId,
            contractTerm,
            paymentMethod,
            options,
            startDate,
            campaignId,
            paymentIntentId: paymentIntent.id,
          }),
        })

        const { error: contractError } = await contractResponse.json()

        if (contractError) {
          setError(`契約の確定に失敗しました: ${contractError}`)
          setLoading(false)
          setIsProcessing(false)
          return
        }

        // 成功画面にリダイレクト（処理完了後）
        setTimeout(() => {
          router.push('/plans/success')
        }, 500)
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError('決済中にエラーが発生しました')
      setLoading(false)
      setIsProcessing(false)
    }
  }

  // 登録済みカードがある場合は、カード情報入力フォームをスキップ
  if (hasPaymentMethod && paymentMethodInfo) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            お支払い情報
          </h2>

          <div className="space-y-4">
            <div className="rounded-md border border-room-base-dark bg-room-base p-4">
              <p className="text-sm font-medium text-room-charcoal mb-2">
                登録済みのカード
              </p>
              <p className="text-sm text-room-charcoal-light">
                {paymentMethodInfo.card?.brand?.toUpperCase() || 'カード'} •••• {paymentMethodInfo.card?.last4}
              </p>
              <p className="text-xs text-room-charcoal-light mt-1">
                有効期限: {paymentMethodInfo.card?.exp_month}/{paymentMethodInfo.card?.exp_year}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4 mb-4 mt-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Link
              href="/plans"
              className="flex-1 rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal text-center"
            >
              キャンセル
            </Link>
            <button
              type="button"
              onClick={onPaymentWithSavedCard}
              disabled={loading || isProcessing}
              className="flex-1 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || isProcessing ? '決済中...' : `¥${totalPrice.toLocaleString()}を支払う`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
        <h2 className="text-lg font-semibold text-room-charcoal mb-4">
          お支払い情報
        </h2>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-room-charcoal mb-2">
            カード情報
          </label>
          
          {/* カード番号 */}
          <div>
            <label className="block text-xs font-medium text-room-charcoal-light mb-1">
              カード番号
            </label>
            <div className="rounded-md border border-room-base-dark bg-room-base p-3">
              <CardNumberElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#1a1a1a',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      '::placeholder': {
                        color: '#999',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* 有効期限とCVC */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-room-charcoal-light mb-1">
                有効期限
              </label>
              <div className="rounded-md border border-room-base-dark bg-room-base p-3">
                <CardExpiryElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#1a1a1a',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        '::placeholder': {
                          color: '#999',
                        },
                      },
                      invalid: {
                        color: '#9e2146',
                      },
                    },
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-room-charcoal-light mb-1">
                CVC
              </label>
              <div className="rounded-md border border-room-base-dark bg-room-base p-3">
                <CardCvcElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#1a1a1a',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        '::placeholder': {
                          color: '#999',
                        },
                      },
                      invalid: {
                        color: '#9e2146',
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4 mb-4">
            <p className="text-sm text-room-main-dark">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/plans"
            className="flex-1 rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal text-center"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={!stripe || loading || isProcessing}
            className="flex-1 rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || isProcessing ? '決済中...' : `¥${totalPrice.toLocaleString()}を支払う`}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  )
}

function CheckoutPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // URLパラメータから契約情報を取得
  const planId = searchParams.get('planId')
  const planType = searchParams.get('planType') as 'workspace' | 'shared_office' | null
  const contractTerm = searchParams.get('contractTerm') as 'monthly' | 'yearly' | null
  const paymentMethod = searchParams.get('paymentMethod') as 'monthly' | 'annual_prepaid' | null
  const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
  const campaignId = searchParams.get('campaignId')
  const optionsStr = searchParams.get('options')

  const [contractData, setContractData] = useState<any>(null)
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null)
  const [paymentMethodInfo, setPaymentMethodInfo] = useState<any>(null)
  const [checkingPaymentMethod, setCheckingPaymentMethod] = useState(true)

  // カード情報の確認
  useEffect(() => {
    const checkPaymentMethod = async () => {
      try {
        const response = await fetch('/api/stripe/check-payment-method')
        const data = await response.json()
        
        if (response.ok) {
          setHasPaymentMethod(data.hasPaymentMethod)
          setPaymentMethodInfo(data.paymentMethod)
        }
      } catch (error) {
        console.error('Payment method check error:', error)
      } finally {
        setCheckingPaymentMethod(false)
      }
    }

    checkPaymentMethod()
  }, [])

  useEffect(() => {
    if (!planId || !contractTerm || !paymentMethod) {
      setError('契約情報が不正です')
      setLoading(false)
      return
    }

    // 契約情報を取得
    const fetchContractData = async () => {
      try {
        const supabase = createClient()
        const { data: plan, error: planError } = await supabase
          .from('plans')
          .select('*')
          .eq('id', planId)
          .single()

        if (planError || !plan) {
          setError('プラン情報の取得に失敗しました')
          setLoading(false)
          return
        }

        const options = optionsStr ? JSON.parse(decodeURIComponent(optionsStr)) : {}

        // 料金計算（契約フォームと同じロジック）
        const ENTRY_FEE = 11000
        
        // キャンペーン情報を取得
        let entryFee = ENTRY_FEE
        let firstMonthFree = false
        
        if (campaignId) {
          const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()
          
          if (campaign) {
            switch (campaign.campaign_type) {
              case 'entry_fee_free':
                entryFee = 0
                break
              case 'entry_fee_50off':
                entryFee = Math.floor(ENTRY_FEE * 0.5)
                break
              case 'entry_fee_custom':
                const discountRate = campaign.discount_rate || 0
                entryFee = Math.floor(ENTRY_FEE * (1 - discountRate / 100))
                break
              case 'first_month_free':
                firstMonthFree = true
                break
            }
          }
        }

        // プラン料金を計算（割引適用）
        // ベース価格は常にworkspace_price（シェアオフィスはオプション料金で加算）
        let planPrice = plan.workspace_price ?? plan.price
        if (contractTerm === 'yearly') {
          planPrice = Math.floor(planPrice * 0.8)
        }
        if (paymentMethod === 'annual_prepaid') {
          planPrice = Math.floor(planPrice * 0.7)
        }

        // 初月の日割り計算
        const start = new Date(startDate)
        const year = start.getFullYear()
        const month = start.getMonth()
        const lastDay = new Date(year, month + 1, 0).getDate()
        const daysFromStart = lastDay - start.getDate() + 1
        const firstMonthFee = firstMonthFree 
          ? 0 
          : Math.ceil((planPrice * daysFromStart) / lastDay)

        // オプション料金を計算
        let optionPrice = 0
        if (options.shared_office) optionPrice += 3300
        if (options.company_registration) optionPrice += 5500
        if (options.printer) optionPrice += 1100
        if (options.twenty_four_hours) optionPrice += 5500
        if (options.fixed_seat) optionPrice += 23100
        if (options.locker && options.locker_size) {
          optionPrice += options.locker_size === 'large' ? 4950 : 2750
        }

        // 合計金額を計算
        let totalPrice = entryFee + firstMonthFee + optionPrice
        if (paymentMethod === 'annual_prepaid') {
          const remainingMonthsPrice = (planPrice + optionPrice) * 11
          totalPrice = entryFee + firstMonthFee + optionPrice + remainingMonthsPrice
        }

        setContractData({
          plan,
          options,
          entryFee,
          firstMonthFee,
          optionPrice,
          totalPrice,
        })
        setLoading(false)
      } catch (err) {
        console.error('Contract data fetch error:', err)
        setError('契約情報の取得に失敗しました')
        setLoading(false)
      }
    }

    fetchContractData()
  }, [planId, contractTerm, paymentMethod, optionsStr])

  // 登録済みカードで決済する処理
  const handlePaymentWithSavedCard = async () => {
    if (!contractData || !paymentMethodInfo) return

    setLoading(true)
    setError(null)

    try {
      // Payment Intentを作成（登録済みのPayment Methodを使用）
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: planId!,
          contractTerm: contractTerm!,
          paymentMethod: paymentMethod!,
          options: contractData.options,
          startDate,
          campaignId,
          entryFee: contractData.entryFee,
          firstMonthFee: contractData.firstMonthFee,
          optionPrice: contractData.optionPrice,
          totalPrice: contractData.totalPrice,
          useSavedPaymentMethod: true, // 登録済みカードを使用
          paymentMethodId: paymentMethodInfo.id,
        }),
      })

      const { clientSecret, paymentIntentId, error: apiError } = await response.json()

      if (apiError || !paymentIntentId) {
        setError(apiError || '決済の準備に失敗しました')
        setLoading(false)
        return
      }

      // 登録済みのPayment Methodを使用する場合、既にconfirm: trueで作成されているので
      // complete-contract APIでPayment Intentのステータスを確認して契約を完了
      const completeResponse = await fetch('/api/plans/complete-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntentId,
          planId: planId!,
          contractTerm: contractTerm!,
          paymentMethod: paymentMethod!,
          options: contractData.options,
          startDate,
          campaignId,
          entryFee: contractData.entryFee,
          firstMonthFee: contractData.firstMonthFee,
          optionPrice: contractData.optionPrice,
          totalPrice: contractData.totalPrice,
        }),
      })

      const completeData = await completeResponse.json()

      if (completeResponse.ok && completeData.success) {
        router.push('/plans/success')
      } else {
        setError(completeData.error || '契約の完了に失敗しました')
        setLoading(false)
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError('決済中にエラーが発生しました')
      setLoading(false)
    }
  }

  if (loading || checkingPaymentMethod) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <p className="text-room-charcoal">読み込み中...</p>
      </div>
    )
  }

  if (error || !contractData) {
    return (
      <div className="min-h-screen bg-room-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-room-main-dark mb-4">{error || '契約情報が見つかりません'}</p>
          <Link
            href="/plans"
            className="text-room-main hover:text-room-main-light"
          >
            プラン一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-room-charcoal mb-8">
          お支払い
        </h1>

        {/* 契約内容の確認 */}
        <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark mb-6">
          <h2 className="text-lg font-semibold text-room-charcoal mb-4">
            契約内容
          </h2>
          <div className="space-y-2 text-sm text-room-charcoal mb-4">
            <div className="flex justify-between">
              <span>プラン:</span>
              <span className="font-medium">{contractData.plan.name}</span>
            </div>
            <div className="flex justify-between">
              <span>契約期間:</span>
              <span className="font-medium">
                {contractTerm === 'yearly' ? '年契約' : '月契約'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>支払い方法:</span>
              <span className="font-medium">
                {paymentMethod === 'annual_prepaid' ? '年一括前払い' : '月払い'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>契約開始日:</span>
              <span className="font-medium">{startDate}</span>
            </div>
          </div>
          
          {/* 料金サマリー */}
          <div className="border-t border-room-base-dark pt-4 space-y-2 text-sm">
            {contractData.entryFee > 0 && (
              <div className="flex justify-between">
                <span>入会金:</span>
                <span className="font-medium">¥{contractData.entryFee.toLocaleString()}</span>
              </div>
            )}
            {contractData.firstMonthFee > 0 && (
              <div className="flex justify-between">
                <span>初月会費（日割り）:</span>
                <span className="font-medium">¥{contractData.firstMonthFee.toLocaleString()}</span>
              </div>
            )}
            {contractData.optionPrice > 0 && (
              <div className="flex justify-between">
                <span>オプション料金:</span>
                <span className="font-medium">¥{contractData.optionPrice.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-room-base-dark font-bold text-room-main">
              <span>合計:</span>
              <span>¥{contractData.totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Stripe Elements */}
        <Elements stripe={stripePromise}>
          <CheckoutForm
            planId={planId!}
            planName={contractData.plan.name}
            contractTerm={contractTerm!}
            paymentMethod={paymentMethod!}
            options={contractData.options}
            startDate={startDate}
            campaignId={campaignId}
            entryFee={contractData.entryFee}
            firstMonthFee={contractData.firstMonthFee}
            optionPrice={contractData.optionPrice}
            totalPrice={contractData.entryFee + contractData.firstMonthFee + contractData.optionPrice}
            hasPaymentMethod={hasPaymentMethod}
            paymentMethodInfo={paymentMethodInfo}
            onPaymentWithSavedCard={handlePaymentWithSavedCard}
          />
        </Elements>
      </div>
    </div>
  )
}

