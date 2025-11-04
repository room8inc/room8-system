'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campaign_type: 'entry_fee_50off' as 'entry_fee_50off' | 'entry_fee_free' | 'first_month_free' | 'entry_fee_custom',
    discount_rate: 0,
    started_at: new Date().toISOString().split('T')[0],
    ended_at: '',
    is_active: true,
    applicable_plan_ids: [] as string[],
  })

  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlans, setSelectedPlans] = useState<string[]>([])

  // プラン一覧を取得
  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('plans')
        .select('id, name, code')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      if (data) {
        setPlans(data)
      }
    }
    fetchPlans()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('ログインが必要です')
        setLoading(false)
        return
      }

      const campaignData: any = {
        name: formData.name,
        description: formData.description || null,
        campaign_type: formData.campaign_type,
        started_at: formData.started_at,
        ended_at: formData.ended_at || null,
        is_active: formData.is_active,
        applicable_plan_ids: selectedPlans.length > 0 ? selectedPlans : null,
      }

      if (formData.campaign_type === 'entry_fee_custom') {
        campaignData.discount_rate = formData.discount_rate
      }

      const { error: insertError } = await supabase
        .from('campaigns')
        .insert(campaignData)

      if (insertError) {
        console.error('Campaign insert error:', insertError)
        setError(`キャンペーンの作成に失敗しました: ${insertError.message}`)
        setLoading(false)
        return
      }

      router.push('/admin/campaigns')
      router.refresh()
    } catch (err) {
      console.error('Campaign error:', err)
      setError('キャンペーン作成中にエラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin/campaigns"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← キャンペーン一覧に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            新規キャンペーン作成
          </h1>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal mb-4">
              基本情報
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-room-charcoal mb-1">
                  キャンペーン名 <span className="text-red-600">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                  placeholder="例: 年末年始キャンペーン"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-room-charcoal mb-1">
                  説明
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                  placeholder="キャンペーンの説明を入力してください"
                />
              </div>

              <div>
                <label htmlFor="campaign_type" className="block text-sm font-medium text-room-charcoal mb-1">
                  キャンペーン種類 <span className="text-red-600">*</span>
                </label>
                <select
                  id="campaign_type"
                  required
                  value={formData.campaign_type}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    campaign_type: e.target.value as any,
                    discount_rate: e.target.value === 'entry_fee_custom' ? 50 : 0
                  })}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                >
                  <option value="entry_fee_50off">入会金50%OFF</option>
                  <option value="entry_fee_free">入会金無料</option>
                  <option value="first_month_free">初月会費無料</option>
                  <option value="entry_fee_custom">入会金カスタム割引</option>
                </select>
              </div>

              {formData.campaign_type === 'entry_fee_custom' && (
                <div>
                  <label htmlFor="discount_rate" className="block text-sm font-medium text-room-charcoal mb-1">
                    割引率 <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="discount_rate"
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={formData.discount_rate}
                      onChange={(e) => setFormData({ ...formData, discount_rate: parseInt(e.target.value) || 0 })}
                      className="w-24 rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                    />
                    <span className="text-sm text-room-charcoal">%OFF</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal mb-4">
              適用期間
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="started_at" className="block text-sm font-medium text-room-charcoal mb-1">
                  開始日 <span className="text-red-600">*</span>
                </label>
                <input
                  id="started_at"
                  type="date"
                  required
                  value={formData.started_at}
                  onChange={(e) => setFormData({ ...formData, started_at: e.target.value })}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                />
              </div>

              <div>
                <label htmlFor="ended_at" className="block text-sm font-medium text-room-charcoal mb-1">
                  終了日（空欄の場合は無期限）
                </label>
                <input
                  id="ended_at"
                  type="date"
                  value={formData.ended_at}
                  onChange={(e) => setFormData({ ...formData, ended_at: e.target.value })}
                  min={formData.started_at}
                  className="w-full rounded-md border border-room-base-dark bg-room-base px-3 py-2 text-sm shadow-sm focus:border-room-main focus:outline-none focus:ring-room-main"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                  />
                  <span className="text-sm text-room-charcoal">
                    有効にする
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-room-base-light p-6 shadow border border-room-base-dark">
            <h2 className="text-lg font-semibold text-room-charcoal mb-4">
              適用プラン
            </h2>
            
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPlans.length === 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPlans([])
                    }
                  }}
                  className="rounded border-room-base-dark text-room-main focus:ring-room-main"
                />
                <span className="text-sm text-room-charcoal font-medium">
                  全プランに適用
                </span>
              </label>
              
              {plans.length > 0 && (
                <div className="ml-6 mt-2 space-y-2 border-l-2 border-room-base-dark pl-4">
                  <p className="text-xs text-room-charcoal-light mb-2">
                    特定のプランのみ適用する場合は、以下から選択してください
                  </p>
                  {plans.map((plan) => (
                    <label key={plan.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlans.includes(plan.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPlans([...selectedPlans, plan.id])
                          } else {
                            setSelectedPlans(selectedPlans.filter(id => id !== plan.id))
                          }
                        }}
                        disabled={selectedPlans.length === 0}
                        className="rounded border-room-base-dark text-room-main focus:ring-room-main disabled:opacity-50"
                      />
                      <span className="text-sm text-room-charcoal">
                        {plan.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-room-main bg-opacity-10 border border-room-main p-4">
              <p className="text-sm text-room-main-dark">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/admin/campaigns"
              className="rounded-md bg-room-charcoal-light px-4 py-2 text-sm text-white hover:bg-room-charcoal"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light focus:outline-none focus:ring-2 focus:ring-room-main focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? '作成中...' : 'キャンペーンを作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

