/**
 * Stripe Price ID 設定
 *
 * テスト環境(sk_test_)と本番環境(sk_live_)で Price ID が異なるため、
 * 管理画面から切り替え可能な StripeMode に基づいて Price ID を返す。
 */

type PlanPrices = {
  monthly: string
  yearly: string
  annual_prepaid: string
}

type StripePriceConfig = {
  plans: Record<string, PlanPrices>
  options: Record<string, string>
  coupons: Record<string, string>
}

// ============================================
// テスト環境 (STRIPE_SECRET_KEY_TEST)
// ============================================
const TEST_PRICES: StripePriceConfig = {
  plans: {
    fulltime: {
      monthly: 'price_1SPewvRZuHLNbQd4AT7CMhst',
      yearly: 'price_1SPewwRZuHLNbQd4vAgbejrj',
      annual_prepaid: 'price_1SPewxRZuHLNbQd4lfgiBKb6',
    },
    weekday: {
      monthly: 'price_1SPewyRZuHLNbQd4HD3DNtEY',
      yearly: 'price_1SPewzRZuHLNbQd4fhbj2CSE',
      annual_prepaid: 'price_1SPex0RZuHLNbQd47QeFf4nJ',
    },
    daytime: {
      monthly: 'price_1SPex4RZuHLNbQd4w4qYnLmQ',
      yearly: 'price_1SPex5RZuHLNbQd47ucSrcgH',
      annual_prepaid: 'price_1SPex5RZuHLNbQd4inFbrHxD',
    },
    night_holiday: {
      monthly: 'price_1SPex1RZuHLNbQd4KKZ00D0Y',
      yearly: 'price_1SPex2RZuHLNbQd4hd1kQsUu',
      annual_prepaid: 'price_1SPex3RZuHLNbQd4ktuwjyUd',
    },
    night: {
      monthly: 'price_1SPex9RZuHLNbQd4i4Ipu0kO',
      yearly: 'price_1SPexARZuHLNbQd4onCapK4k',
      annual_prepaid: 'price_1SPexBRZuHLNbQd4WCfE8e6x',
    },
    holiday: {
      monthly: 'price_1SPex6RZuHLNbQd4Vr1kGxyM',
      yearly: 'price_1SPex7RZuHLNbQd4TRDOj30p',
      annual_prepaid: 'price_1SPex9RZuHLNbQd49d2yOHoy',
    },
    // 旧プラン（既存契約者向け）
    entrepreneur: {
      monthly: 'price_1SPewmRZuHLNbQd4L6v1IadB',
      yearly: 'price_1SPewnRZuHLNbQd4WSAWaMmU',
      annual_prepaid: 'price_1SPewoRZuHLNbQd4akIRrTHd',
    },
    regular: {
      monthly: 'price_1SPewqRZuHLNbQd40y5Umick',
      yearly: 'price_1SPewqRZuHLNbQd4OrWPeGPb',
      annual_prepaid: 'price_1SPewrRZuHLNbQd4IaKD7XM4',
    },
    light: {
      monthly: 'price_1SPewsRZuHLNbQd48oINvpnb',
      yearly: 'price_1SPewtRZuHLNbQd4hwwGf1ag',
      annual_prepaid: 'price_1SPewuRZuHLNbQd4KgGPO9j3',
    },
  },
  options: {
    shared_office: 'price_1SzFViRZuHLNbQd4x0AgVzHU',
    company_registration: 'price_1SPexERZuHLNbQd49vT0hbfC',
    twenty_four_hours: 'price_1SPexCRZuHLNbQd4LoXHhmuA',
    locker_large: 'price_1SPexERZuHLNbQd4Dhey5R11',
    locker_small: 'price_1SPexFRZuHLNbQd4pxw79LnK',
    printer: 'price_1SPexDRZuHLNbQd4JQxzdzmK',
  },
  coupons: {
    group_second_slot: 'group_50off',
  },
}

// ============================================
// 本番環境 (STRIPE_SECRET_KEY)
// ============================================
const LIVE_PRICES: StripePriceConfig = {
  plans: {
    fulltime: {
      monthly: 'price_1PBTEvDYzeuaMwz6TyXvLgBE',       // ¥16,500
      yearly: 'price_1QpQxlDYzeuaMwz6mf0yTrHJ',        // ¥13,200 長期契約割引
      annual_prepaid: 'price_1QmCkFDYzeuaMwz6hBnCWYya', // ¥138,600 年一括
    },
    weekday: {
      monthly: 'price_1PBTGZDYzeuaMwz6Z4CYwKWS',       // ¥13,200
      yearly: 'price_1QpQwwDYzeuaMwz6w6r5Oclx',        // ¥10,560
      annual_prepaid: 'price_1QmCjUDYzeuaMwz6hGETaNBw', // ¥110,880
    },
    daytime: {
      monthly: 'price_1PBTIODYzeuaMwz6OKqghQTq',       // ¥11,000
      yearly: 'price_1QpQtPDYzeuaMwz6pkgeZODd',        // ¥8,800
      annual_prepaid: 'price_1QmCibDYzeuaMwz6P2rUnvvD', // ¥92,400
    },
    night_holiday: {
      monthly: 'price_1PBTHNDYzeuaMwz60ax0t14g',       // ¥9,900
      yearly: 'price_1QpQw3DYzeuaMwz6nuNS6uty',        // ¥7,920
      annual_prepaid: 'price_1QmCh5DYzeuaMwz6ZKsXUqtr', // ¥83,160
    },
    night: {
      monthly: 'price_1PBTNLDYzeuaMwz6q1oGVRhx',       // ¥6,600
      yearly: 'price_1QmwHQDYzeuaMwz6Va5mMrLE',        // ¥5,280
      annual_prepaid: 'price_1QmCg2DYzeuaMwz6z8rQX6ue', // ¥55,440
    },
    holiday: {
      monthly: 'price_1PBTNkDYzeuaMwz6JxEJeVLV',       // ¥6,600
      yearly: 'price_1QmwDUDYzeuaMwz6dQ21WOGO',        // ¥5,280
      annual_prepaid: 'price_1QmCfCDYzeuaMwz6a1azZ49I', // ¥55,440
    },
    // 旧プラン（既存契約者向け）
    entrepreneur: {
      monthly: 'price_1PBT0nDYzeuaMwz6p1jQOuFD',       // ¥55,000
      yearly: 'price_1QpRCEDYzeuaMwz6MhP6UVZx',        // ¥44,000
      annual_prepaid: 'price_1QmCeIDYzeuaMwz6yEBZ2gdz', // ¥462,000
    },
    regular: {
      monthly: 'price_1PBT4iDYzeuaMwz63fT34S2j',       // ¥19,800
      yearly: 'price_1QpR0eDYzeuaMwz6BFkrQw5y',        // ¥15,840
      annual_prepaid: 'price_1QmCdQDYzeuaMwz68qjBKg10', // ¥166,320
    },
    light: {
      monthly: 'price_1PBT5SDYzeuaMwz6ai6oljTj',       // ¥16,500
      yearly: 'price_1QpQyYDYzeuaMwz6J54VPBXT',        // ¥13,200
      annual_prepaid: 'price_1QmCXlDYzeuaMwz6tlGErCq2', // ¥138,600
    },
  },
  options: {
    shared_office: 'price_1SzGQRDYzeuaMwz6wXy4AqqD',      // ¥3,300
    company_registration: 'price_1RA3NtDYzeuaMwz6Ffe2xv11', // ¥5,500
    twenty_four_hours: 'price_1RA3QPDYzeuaMwz6CHxTkJXk',    // ¥5,500
    locker_large: 'price_1RA3NYDYzeuaMwz6lIMFhXzd',         // ¥4,950
    locker_small: 'price_1PengnDYzeuaMwz67gnGvbai',         // ¥2,200
    printer: 'price_1RA3PWDYzeuaMwz6czajyskf',              // ¥1,100
  },
  coupons: {
    group_second_slot: '7Vig6pTt',
  },
}

// ============================================
// ヘルパー関数
// ============================================

import type { StripeMode } from '@/lib/stripe/mode'

function getConfig(mode: StripeMode): StripePriceConfig {
  return mode === 'live' ? LIVE_PRICES : TEST_PRICES
}

export function getPlanPriceId(
  planCode: string,
  type: 'monthly' | 'yearly' | 'annual_prepaid',
  mode: StripeMode
): string | null {
  return getConfig(mode).plans[planCode]?.[type] ?? null
}

export function getOptionPriceId(optionCode: string, mode: StripeMode): string | null {
  return getConfig(mode).options[optionCode] ?? null
}

export function getCouponId(couponCode: string, mode: StripeMode): string | null {
  return getConfig(mode).coupons[couponCode] || null
}
