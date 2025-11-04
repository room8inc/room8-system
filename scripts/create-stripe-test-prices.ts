import Stripe from 'stripe'
import * as fs from 'fs'

// テスト環境のStripe APIキーを使用してください
// 環境変数: STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST || '', {
  apiVersion: '2025-10-29.clover',
})

// プランとPriceIDのマッピング（本番環境の情報）
// 提供されたPriceIDリストに基づいて、プランcodeとマッピング
const planPriceMapping = [
  // シェアオフィス - 起業家プラン（code: entrepreneur）
  { planCode: 'entrepreneur', planName: '起業家プラン', contractType: 'monthly', price: 55000, category: 'shared_office' },
  { planCode: 'entrepreneur', planName: '起業家プラン', contractType: 'yearly', price: 44000, category: 'shared_office' },
  { planCode: 'entrepreneur', planName: '起業家プラン', contractType: 'annual_prepaid', price: 462000, category: 'shared_office' },
  
  // シェアオフィス - レギュラープラン（code: regular）
  { planCode: 'regular', planName: 'レギュラープラン', contractType: 'monthly', price: 19800, category: 'shared_office' },
  { planCode: 'regular', planName: 'レギュラープラン', contractType: 'yearly', price: 15840, category: 'shared_office' },
  { planCode: 'regular', planName: 'レギュラープラン', contractType: 'annual_prepaid', price: 166320, category: 'shared_office' },
  
  // シェアオフィス - ライトプラン（code: light）
  { planCode: 'light', planName: 'ライトプラン', contractType: 'monthly', price: 16500, category: 'shared_office' },
  { planCode: 'light', planName: 'ライトプラン', contractType: 'yearly', price: 13200, category: 'shared_office' },
  { planCode: 'light', planName: 'ライトプラン', contractType: 'annual_prepaid', price: 138600, category: 'shared_office' },
  
  // コワーキング - フルタイムプラン（code: fulltime）
  { planCode: 'fulltime', planName: 'フルタイムプラン', contractType: 'monthly', price: 16500, category: 'coworking' },
  { planCode: 'fulltime', planName: 'フルタイムプラン', contractType: 'yearly', price: 13200, category: 'coworking' },
  { planCode: 'fulltime', planName: 'フルタイムプラン', contractType: 'annual_prepaid', price: 138600, category: 'coworking' },
  
  // コワーキング - ウィークデイプラン（code: weekday）
  { planCode: 'weekday', planName: 'ウィークデイプラン', contractType: 'monthly', price: 13200, category: 'coworking' },
  { planCode: 'weekday', planName: 'ウィークデイプラン', contractType: 'yearly', price: 10560, category: 'coworking' },
  { planCode: 'weekday', planName: 'ウィークデイプラン', contractType: 'annual_prepaid', price: 110880, category: 'coworking' },
  
  // コワーキング - ナイト&ホリデープラン（code: night_holiday）
  { planCode: 'night_holiday', planName: 'ナイト&ホリデープラン', contractType: 'monthly', price: 9900, category: 'coworking' },
  { planCode: 'night_holiday', planName: 'ナイト&ホリデープラン', contractType: 'yearly', price: 7920, category: 'coworking' },
  { planCode: 'night_holiday', planName: 'ナイト&ホリデープラン', contractType: 'annual_prepaid', price: 83160, category: 'coworking' },
  
  // コワーキング - デイタイムプラン（code: daytime）
  { planCode: 'daytime', planName: 'デイタイムプラン', contractType: 'monthly', price: 11000, category: 'coworking' },
  { planCode: 'daytime', planName: 'デイタイムプラン', contractType: 'yearly', price: 8800, category: 'coworking' },
  { planCode: 'daytime', planName: 'デイタイムプラン', contractType: 'annual_prepaid', price: 92400, category: 'coworking' },
  
  // コワーキング - ホリデープラン（code: holiday）
  { planCode: 'holiday', planName: 'ホリデープラン', contractType: 'monthly', price: 6600, category: 'coworking' },
  { planCode: 'holiday', planName: 'ホリデープラン', contractType: 'yearly', price: 5280, category: 'coworking' },
  { planCode: 'holiday', planName: 'ホリデープラン', contractType: 'annual_prepaid', price: 55440, category: 'coworking' },
  
  // コワーキング - ナイトプラン（code: night）
  { planCode: 'night', planName: 'ナイトプラン', contractType: 'monthly', price: 6600, category: 'coworking' },
  { planCode: 'night', planName: 'ナイトプラン', contractType: 'yearly', price: 5280, category: 'coworking' },
  { planCode: 'night', planName: 'ナイトプラン', contractType: 'annual_prepaid', price: 55440, category: 'coworking' },
]

// オプションのPriceIDマッピング
const optionPriceMapping = [
  { optionName: '24時間利用', price: 5500 },
  { optionName: 'プリンター利用', price: 1100 },
  { optionName: '法人登記', price: 5500 },
  { optionName: 'ロッカー大', price: 4950 },
  { optionName: 'ロッカー小', price: 2200 },
]

async function createTestPrices() {
  console.log('テスト環境用PriceIDを作成します...\n')

  // プラン用PriceIDを作成
  console.log('=== プラン用PriceID作成 ===')
  const planPrices: { [key: string]: string } = {}
  
  for (const plan of planPriceMapping) {
    try {
      // まずProductを作成または取得（プランcodeを使用）
      const productName = `${plan.category}_${plan.planCode}`
      let product = await stripe.products.search({
        query: `name:'${productName}' AND metadata['plan_code']:'${plan.planCode}'`,
      })

      let productId: string
      if (product.data.length === 0) {
        product = await stripe.products.create({
          name: productName,
          metadata: {
            plan_code: plan.planCode,
            plan_name: plan.planName,
            category: plan.category,
          },
        })
        productId = product.id
      } else {
        productId = product.data[0].id
      }

      // 既存のPriceIDをチェック（同じプランcode、契約形態、価格のもの）
      const existingPrices = await stripe.prices.list({
        product: productId,
        active: true,
      })

      // 既存のPriceIDがあるかチェック
      const existingPrice = existingPrices.data.find(
        (p) => 
          p.unit_amount === plan.price &&
          p.metadata.contract_type === plan.contractType &&
          p.metadata.plan_code === plan.planCode
      )

      let priceId: string
      if (existingPrice) {
        priceId = existingPrice.id
        console.log(`→ 既存のPriceIDを使用: ${plan.planName} (${plan.contractType}): ${priceId}`)
      } else {
        // Priceを作成
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: plan.price,
          currency: 'jpy',
          recurring: plan.contractType === 'annual_prepaid' ? undefined : {
            interval: 'month',
          },
          metadata: {
            plan_code: plan.planCode,
            plan_name: plan.planName,
            contract_type: plan.contractType,
            category: plan.category,
          },
        })
        priceId = price.id
        console.log(`✓ 新規作成: ${plan.planName} (${plan.contractType}): ${priceId}`)
      }

      const key = `${plan.planCode}_${plan.contractType}`
      planPrices[key] = priceId
    } catch (error) {
      console.error(`✗ ${plan.planName} (${plan.contractType}):`, error)
    }
  }

  // オプション用PriceIDを作成
  console.log('\n=== オプション用PriceID作成 ===')
  const optionPrices: { [key: string]: string } = {}
  
  for (const option of optionPriceMapping) {
    try {
      let product = await stripe.products.search({
        query: `name:'${option.optionName}'`,
      })

      let productId: string
      if (product.data.length === 0) {
        product = await stripe.products.create({
          name: option.optionName,
          metadata: {
            type: 'option',
          },
        })
        productId = product.id
      } else {
        productId = product.data[0].id
      }

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: option.price,
        currency: 'jpy',
        recurring: {
          interval: 'month',
        },
        metadata: {
          option_name: option.optionName,
        },
      })

      optionPrices[option.optionName] = price.id
      console.log(`✓ ${option.optionName}: ${price.id}`)
    } catch (error) {
      console.error(`✗ ${option.optionName}:`, error)
    }
  }

  // 結果をJSONファイルに出力
  const result = {
    plans: planPrices,
    options: optionPrices,
    created_at: new Date().toISOString(),
  }

  fs.writeFileSync(
    'stripe-test-prices.json',
    JSON.stringify(result, null, 2)
  )

  console.log('\n=== 完了 ===')
  console.log('結果を stripe-test-prices.json に保存しました')
  console.log('\n作成されたPriceID:')
  console.log(JSON.stringify(result, null, 2))
}

// 実行
if (require.main === module) {
  createTestPrices().catch(console.error)
}

export { createTestPrices }

