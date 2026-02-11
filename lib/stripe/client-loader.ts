'use client'

import { loadStripe } from '@stripe/stripe-js'
import type { Stripe } from '@stripe/stripe-js'

let cachedMode: 'test' | 'live' | null = null
let stripeTestPromise: Promise<Stripe | null> | null = null
let stripeLivePromise: Promise<Stripe | null> | null = null

/**
 * 現在の Stripe モードを取得（キャッシュあり）
 */
export async function fetchStripeMode(): Promise<'test' | 'live'> {
  if (cachedMode) return cachedMode
  try {
    const res = await fetch('/api/admin/settings/stripe-mode')
    if (res.ok) {
      const data = await res.json()
      cachedMode = data.mode === 'live' ? 'live' : 'test'
    } else {
      cachedMode = 'test'
    }
  } catch {
    cachedMode = 'test'
  }
  return cachedMode
}

/**
 * モードに対応する Stripe.js インスタンスを返す
 */
export function getStripePromise(mode: 'test' | 'live'): Promise<Stripe | null> {
  if (mode === 'live') {
    if (!stripeLivePromise) {
      stripeLivePromise = loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
      )
    }
    return stripeLivePromise
  }
  if (!stripeTestPromise) {
    stripeTestPromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || ''
    )
  }
  return stripeTestPromise
}

/**
 * モードの手動リセット（管理画面でモード切替後に呼ぶ）
 */
export function resetStripeModeCache() {
  cachedMode = null
}
