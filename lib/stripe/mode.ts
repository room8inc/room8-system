/**
 * Stripe モード管理
 *
 * Vercel KV に stripe_mode を保存し、管理画面から切り替え可能にする。
 * KV が利用できない場合（ローカル開発等）は 'test' をデフォルトとする。
 */

import { kv } from '@vercel/kv'

export type StripeMode = 'test' | 'live'

const STRIPE_MODE_KEY = 'system:stripe_mode'

function isKVAvailable(): boolean {
  const url = process.env.KV_REST_API_URL || process.env.KV_REDIS_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.KV_REDIS_TOKEN
  return Boolean(url && token)
}

export async function getStripeMode(): Promise<StripeMode> {
  try {
    if (!isKVAvailable()) return 'test'
    const mode = await kv.get<string>(STRIPE_MODE_KEY)
    return mode === 'live' ? 'live' : 'test'
  } catch {
    return 'test'
  }
}

export async function setStripeMode(mode: StripeMode): Promise<void> {
  if (!isKVAvailable()) {
    throw new Error('Vercel KV が利用できません')
  }
  await kv.set(STRIPE_MODE_KEY, mode)
}
