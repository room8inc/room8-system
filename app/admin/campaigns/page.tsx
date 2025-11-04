import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/utils/admin'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 管理者権限チェック
  const admin = await isAdmin()
  if (!admin) {
    redirect('/dashboard')
  }

  // キャンペーン一覧を取得
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  // プラン一覧を取得（適用プラン選択用）
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const campaignTypeLabels: { [key: string]: string } = {
    entry_fee_50off: '入会金50%OFF',
    entry_fee_free: '入会金無料',
    first_month_free: '初月会費無料',
    entry_fee_custom: '入会金カスタム割引',
  }

  return (
    <div className="min-h-screen bg-room-base">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-sm text-room-main hover:text-room-main-light"
          >
            ← 管理者画面に戻る
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-room-charcoal">
            キャンペーン管理
          </h1>
          <p className="mt-2 text-sm text-room-charcoal-light">
            キャンペーンの作成・編集・削除ができます
          </p>
        </div>

        {/* エラー表示 */}
        {campaignsError && (
          <div className="mb-8 rounded-lg bg-room-main bg-opacity-10 border border-room-main p-6">
            <p className="text-sm text-room-main-dark">
              キャンペーン情報の取得に失敗しました: {campaignsError.message}
            </p>
          </div>
        )}

        {/* 新規キャンペーン作成ボタン */}
        <div className="mb-6">
          <Link
            href="/admin/campaigns/new"
            className="inline-block rounded-md bg-room-main px-4 py-2 text-sm text-white hover:bg-room-main-light"
          >
            + 新規キャンペーンを作成
          </Link>
        </div>

        {/* キャンペーン一覧 */}
        {campaigns && campaigns.length > 0 ? (
          <div className="rounded-lg bg-room-base-light shadow border border-room-base-dark overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-room-base-dark">
                <thead className="bg-room-base-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                      キャンペーン名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                      種類
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                      適用期間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                      適用プラン
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-room-charcoal uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-room-base-light divide-y divide-room-base-dark">
                  {campaigns.map((campaign) => {
                    const isActive = campaign.is_active && 
                      (!campaign.ended_at || new Date(campaign.ended_at) >= new Date())
                    const applicablePlans = campaign.applicable_plan_ids && campaign.applicable_plan_ids.length > 0
                      ? plans?.filter(p => campaign.applicable_plan_ids?.includes(p.id))
                      : null

                    return (
                      <tr key={campaign.id} className="hover:bg-room-base">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-room-charcoal">
                            {campaign.name}
                          </div>
                          {campaign.description && (
                            <div className="text-xs text-room-charcoal-light mt-1">
                              {campaign.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-room-charcoal-light">
                            {campaignTypeLabels[campaign.campaign_type] || campaign.campaign_type}
                            {campaign.campaign_type === 'entry_fee_custom' && campaign.discount_rate && (
                              <span className="ml-1">({campaign.discount_rate}%OFF)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-room-charcoal-light">
                            {new Date(campaign.started_at).toLocaleDateString('ja-JP')} 〜
                            {campaign.ended_at 
                              ? new Date(campaign.ended_at).toLocaleDateString('ja-JP')
                              : '無期限'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-room-charcoal-light">
                            {applicablePlans && applicablePlans.length > 0 ? (
                              <div className="space-y-1">
                                {applicablePlans.slice(0, 3).map((plan) => (
                                  <div key={plan.id}>{plan.name}</div>
                                ))}
                                {applicablePlans.length > 3 && (
                                  <div className="text-xs">他{applicablePlans.length - 3}プラン</div>
                                )}
                              </div>
                            ) : (
                              <span>全プラン</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-room-main text-white">
                              有効
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-room-charcoal-light text-white">
                              無効
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/admin/campaigns/${campaign.id}/edit`}
                            className="text-room-main hover:text-room-main-light"
                          >
                            編集
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-room-wood bg-opacity-10 border border-room-wood p-6 text-center">
            <p className="text-sm text-room-wood-dark">
              キャンペーンが登録されていません
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

