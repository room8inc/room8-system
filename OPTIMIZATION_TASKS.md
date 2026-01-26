# Room8 システム最適化タスク

**作成日**: 2026年1月26日  
**目的**: レスポンス速度の改善とリクエスト数の削減

---

## 📊 期待効果サマリー

| 項目 | 現状 | 改善後 | 効果 |
|------|------|--------|------|
| 座席状態ポーリング | 86,400リクエスト/日 | 0リクエスト/日 | **100%削減** |
| Googleカレンダー取得 | 900リクエスト/日 | 90リクエスト/日 | **90%削減** |
| DBクエリ数（ダッシュボード） | 3,600/日 | 1,200/日 | **66%削減** |
| ダッシュボード読み込み | 500ms | 150ms | **70%高速化** |
| 会議室予約ページ | 800ms | 200ms | **75%高速化** |

---

## 🔴 Phase 1: 最優先（即座に効果が出る）

### 1. Supabase Realtimeへの移行（座席表）

- [x] **実装完了** ✅ (2026-01-26)
- **ファイル**: `app/dashboard/seat-map.tsx`
- **実装時間**: 1-2時間
- **効果**: ポーリング削減 100%
- **難易度**: 低

#### 実装内容

```typescript
// app/dashboard/seat-map.tsx
// 変更点: 30秒ポーリング → Supabase Realtime購読

useEffect(() => {
  fetchSeatStatus()
  
  // Supabase Realtimeで座席チェックインをリアルタイム監視
  const channel = supabase
    .channel('seat-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'seat_checkins'
      },
      (payload) => {
        fetchSeatStatus()
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

#### チェックリスト

- [x] `setInterval`ポーリングを削除
- [x] Supabase Realtimeチャネルを購読
- [ ] 座席チェックイン/アウト時に自動更新されることを確認 ⚠️ **要テスト**
- [ ] メモリリークがないか確認（コンポーネントアンマウント時にチャネル解除） ⚠️ **要テスト**
- [ ] 動作確認: 2つのブラウザで同時に開いてリアルタイム更新をテスト ⚠️ **要テスト**

---

### 2. Googleカレンダー取得のキャッシュ強化

- [x] **実装完了** ✅ (2026-01-26)
- **ファイル**: `app/api/calendar/week-events/route.ts`
- **実装時間**: 1時間
- **効果**: API呼び出し 90%削減
- **難易度**: 低

#### 実装内容

```typescript
// app/api/calendar/week-events/route.ts
import { cache as reactCache } from 'react'
import { getCached, cacheKey } from '@/lib/cache/vercel-kv'
import { createClient } from '@/lib/supabase/server'

const getWeekEvents = reactCache(async (startDate: string, endDate: string) => {
  return getCached(
    cacheKey('calendar_events', startDate, endDate),
    async () => {
      const supabase = await createClient()
      
      // DBキャッシュを確認
      const { data: cachedEvents } = await supabase
        .from('google_calendar_events_cache')
        .select('event_id, summary, start_time, end_time')
        .gte('start_time', `${startDate}T00:00:00+09:00`)
        .lte('end_time', `${endDate}T23:59:59+09:00`)
      
      if (cachedEvents && cachedEvents.length > 0) {
        return cachedEvents.map(e => ({
          id: e.event_id,
          summary: e.summary,
          start: e.start_time,
          end: e.end_time,
        }))
      }
      
      // DBにもない場合のみGoogle APIを叩く
      const { calendar, calendarId } = await getGoogleCalendarClient()
      const response = await calendar.events.list({
        calendarId: calendarId,
        timeMin: new Date(`${startDate}T00:00:00+09:00`).toISOString(),
        timeMax: new Date(`${endDate}T23:59:59+09:00`).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      })
      
      const events = response.data.items || []
      
      // DBに保存
      if (events.length > 0) {
        await supabase.from('google_calendar_events_cache').upsert(
          events.map(event => ({
            event_id: event.id,
            calendar_id: calendarId,
            summary: event.summary || '',
            start_time: event.start?.dateTime,
            end_time: event.end?.dateTime,
          })),
          { onConflict: 'event_id,calendar_id' }
        )
      }
      
      return events.map((event: any) => ({
        id: event.id,
        summary: event.summary || '',
        start: event.start?.dateTime || null,
        end: event.end?.dateTime || null,
      }))
    },
    300 // 5分キャッシュ
  )
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { startDate, endDate } = body
  
  if (!startDate || !endDate) {
    return NextResponse.json({ error: '日付範囲が指定されていません' }, { status: 400 })
  }
  
  const events = await getWeekEvents(startDate, endDate)
  return NextResponse.json({ events })
}
```

#### チェックリスト

- [x] `google_calendar_events_cache`テーブルから取得するロジックを追加
- [x] キャッシュがない場合のみGoogle APIを呼ぶ
- [x] Vercel KVで5分間キャッシュ
- [x] React 18の`cache`で同一リクエスト内の重複呼び出しを防止
- [ ] 動作確認: 会議室予約ページを複数回リロードしてキャッシュヒットを確認 ⚠️ **要テスト**
- [ ] Google APIの呼び出し回数をログで確認 ⚠️ **要テスト**

---

### 3. データベースインデックス追加

- [x] **実装完了** ✅ (2026-01-26)
- **ファイル**: `supabase/migrations/053_performance_indexes.sql`（新規作成）
- **実装時間**: 30分
- **効果**: クエリ速度 30-50%向上
- **難易度**: 低

#### 実装内容

```sql
-- supabase/migrations/053_performance_indexes.sql
-- パフォーマンス最適化のためのインデックス追加

-- ============================================
-- 1. checkins テーブル
-- ============================================

-- 現在チェックイン中のユーザーを取得（頻繁に使用）
CREATE INDEX IF NOT EXISTS idx_checkins_user_active 
  ON checkins(user_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- 最近のチェックイン履歴を取得（ダッシュボード）
CREATE INDEX IF NOT EXISTS idx_checkins_user_recent 
  ON checkins(user_id, checkin_at DESC) 
  INCLUDE (id, checkout_at, duration_minutes);

-- 時間外利用の集計
CREATE INDEX IF NOT EXISTS idx_checkins_overtime 
  ON checkins(user_id, is_overtime, overtime_fee_billed) 
  WHERE is_overtime = true;

-- ============================================
-- 2. user_plans テーブル
-- ============================================

-- 現在アクティブなプランを取得（頻繁に使用）
CREATE INDEX IF NOT EXISTS idx_user_plans_user_active 
  ON user_plans(user_id, status, ended_at) 
  WHERE status = 'active' AND ended_at IS NULL;

-- ============================================
-- 3. meeting_room_bookings テーブル
-- ============================================

-- 日付・ステータスでの検索（会議室予約の空き状況確認）
CREATE INDEX IF NOT EXISTS idx_bookings_date_status 
  ON meeting_room_bookings(booking_date, status)
  WHERE status IN ('reserved', 'confirmed', 'in_use');

-- 未決済の予約を取得（月次請求バッチ）
CREATE INDEX IF NOT EXISTS idx_bookings_billing 
  ON meeting_room_bookings(billing_month, payment_status, member_type_at_booking)
  WHERE payment_status = 'pending';

-- ============================================
-- 4. seat_checkins テーブル
-- ============================================

-- 現在使用中の座席を取得（座席表）
CREATE INDEX IF NOT EXISTS idx_seat_checkins_seat_active 
  ON seat_checkins(seat_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- ユーザーの現在の座席を取得
CREATE INDEX IF NOT EXISTS idx_seat_checkins_user_active 
  ON seat_checkins(user_id, checkout_at) 
  WHERE checkout_at IS NULL;

-- ============================================
-- 5. google_calendar_events_cache テーブル
-- ============================================

-- 日時範囲でのイベント検索
CREATE INDEX IF NOT EXISTS idx_calendar_cache_time_range 
  ON google_calendar_events_cache(calendar_id, start_time, end_time);

-- ============================================
-- Comments
-- ============================================
COMMENT ON INDEX idx_checkins_user_active IS 'チェックイン中のユーザーを高速取得';
COMMENT ON INDEX idx_checkins_user_recent IS 'カバリングインデックス: 最近のチェックイン履歴';
COMMENT ON INDEX idx_user_plans_user_active IS 'アクティブなプランを高速取得';
COMMENT ON INDEX idx_bookings_date_status IS '会議室予約の空き状況を高速確認';
COMMENT ON INDEX idx_seat_checkins_seat_active IS '使用中の座席を高速取得';
COMMENT ON INDEX idx_calendar_cache_time_range IS 'Googleカレンダーキャッシュの日時範囲検索';
```

#### チェックリスト

- [x] マイグレーションファイルを作成
- [ ] Supabaseダッシュボードでマイグレーションを実行 ⚠️ **要実行**
- [ ] インデックスが正しく作成されたか確認（`\di`でインデックス一覧を確認） ⚠️ **要確認**
- [ ] 実行計画を確認してインデックスが使われているか検証（`EXPLAIN ANALYZE`） ⚠️ **要確認**
- [ ] 動作確認: ダッシュボード・座席表・会議室予約のレスポンス速度を測定 ⚠️ **要テスト**

---

## 🟡 Phase 2: 短期（1週間以内）

### 4. DBクエリの統合（JOIN）

- [ ] **実装完了**
- **ファイル**: `app/dashboard/page.tsx`, `app/meeting-rooms/page.tsx`
- **実装時間**: 2-3時間
- **効果**: クエリ数 66%削減
- **難易度**: 中

#### 実装内容

```typescript
// app/dashboard/page.tsx
// 変更点: 3つの独立したクエリ → 1つのJOINクエリ

const userWithPlan = await getCached(
  cacheKey('user_with_plan', user.id),
  async () => {
    const { data } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        is_staff,
        is_admin,
        stripe_customer_id,
        company_name,
        is_individual,
        user_plans!inner (
          id,
          plan_id,
          started_at,
          ended_at,
          status,
          plans (
            id,
            name,
            start_time,
            end_time,
            available_days,
            features
          )
        )
      `)
      .eq('id', user.id)
      .eq('user_plans.status', 'active')
      .is('user_plans.ended_at', null)
      .single()
    
    return data
  },
  300 // 5分
)

// これで userData, currentPlan, planData が全て取得できる
const userData = userWithPlan
const currentPlan = userWithPlan?.user_plans?.[0] || null
const planData = currentPlan?.plans || null
const admin = userWithPlan?.is_admin || false
```

#### チェックリスト

- [ ] ダッシュボードのクエリを統合
- [ ] 会議室予約ページのクエリを統合
- [ ] 既存の機能が正常に動作することを確認
- [ ] レスポンス時間を測定して改善を確認
- [ ] キャッシュヒット率をログで確認

---

### 5. キャッシュTTLの統一

- [ ] **実装完了**
- **ファイル**: `lib/constants.ts`（新規作成）
- **実装時間**: 1時間
- **効果**: 保守性向上 + 微増速化
- **難易度**: 低

#### 実装内容

```typescript
// lib/constants.ts
/**
 * Room8システム全体の定数定義
 */

// ============================================
// キャッシュTTL（秒）
// ============================================
export const CACHE_TTL = {
  // ユーザー関連（変更頻度: 低）
  USER_DATA: 300,        // 5分
  USER_PLAN: 300,        // 5分
  STAFF_MEMBER: 600,     // 10分
  ADMIN_CHECK: 600,      // 10分
  
  // リアルタイム性が重要（変更頻度: 高）
  // ※ Supabase Realtimeに移行推奨
  SEAT_STATUS: 10,       // 10秒
  CHECKIN_STATUS: 10,    // 10秒
  
  // 会議室関連（変更頻度: 中）
  CALENDAR_EVENTS: 300,  // 5分
  BOOKINGS: 60,          // 1分
  MONTHLY_OVERTIME: 60,  // 1分
  
  // 静的データ（変更頻度: 非常に低）
  PLANS: 3600,           // 1時間
  MEETING_ROOMS: 3600,   // 1時間
  CAMPAIGNS: 600,        // 10分
} as const

// ============================================
// Next.js revalidate設定（秒）
// ============================================
export const PAGE_REVALIDATE = {
  DASHBOARD: 20,         // 20秒（リアルタイム性重視）
  MEETING_ROOMS: 60,     // 60秒
  MEMBER_CARD: 60,       // 60秒
  ADMIN: 60,             // 60秒
} as const

// ============================================
// 料金設定
// ============================================
export const BILLING = {
  // ドロップイン
  MAX_DROPIN_FEE: 2000,                    // 最大料金（円）
  
  // 時間外利用
  OVERTIME_GRACE_MINUTES: 10,              // 猶予時間（分）
  OVERTIME_CHARGE_START_MINUTES: 15,       // 課金開始時間（分）
  OVERTIME_RATE_PER_HOUR: 500,             // 1時間あたりの料金（円）
} as const

// ============================================
// 会議室料金
// ============================================
export const MEETING_ROOM = {
  MEMBER_RATE: 1100,                       // 会員料金（1時間・円）
  NON_MEMBER_RATE: 2200,                   // 非会員料金（1時間・円）
  FREE_HOURS_SHARE_OFFICE: 4,              // シェアオフィスプランの無料時間
} as const

// ============================================
// 座席
// ============================================
export const SEATS = {
  FREE_SPACE_COUNT: 19,                    // フリースペース座席数
  MEETING_ROOM_COUNT: 8,                   // 会議室座席数
  TOTAL_COUNT: 27,                         // 合計座席数
} as const

// ============================================
// タイムゾーン
// ============================================
export const TIMEZONE = 'Asia/Tokyo' as const
```

#### チェックリスト

- [ ] `lib/constants.ts`を作成
- [ ] 全APIルートで定数を使うように修正
- [ ] 全ページコンポーネントで定数を使うように修正
- [ ] マジックナンバーがないことを確認（全数値が定数化されている）
- [ ] 動作確認: すべての機能が正常に動作することを確認

---

## 🟢 Phase 3: 中期（2-4週間）

### 6. 共通ユーティリティ関数の作成

- [ ] **実装完了**
- **ファイル**: `lib/utils/user-data.ts`, `lib/api/middleware.ts`
- **実装時間**: 3-4時間
- **効果**: コード量 20%削減、保守性向上
- **難易度**: 中

#### 実装内容

```typescript
// lib/utils/user-data.ts
import { getCached, cacheKey } from '@/lib/cache/vercel-kv'
import { createClient } from '@/lib/supabase/server'
import { CACHE_TTL } from '@/lib/constants'

/**
 * ユーザー情報とプラン情報を取得（キャッシュ付き）
 */
export async function getUserWithPlan(userId: string) {
  return getCached(
    cacheKey('user_with_plan', userId),
    async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          is_staff,
          is_admin,
          stripe_customer_id,
          company_name,
          is_individual,
          user_plans!left (
            id,
            plan_id,
            started_at,
            ended_at,
            status,
            plans (
              id,
              name,
              code,
              start_time,
              end_time,
              available_days,
              features
            )
          )
        `)
        .eq('id', userId)
        .eq('user_plans.status', 'active')
        .is('user_plans.ended_at', null)
        .single()
      
      return data
    },
    CACHE_TTL.USER_DATA
  )
}

/**
 * 管理者かどうかをチェック（キャッシュ付き）
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const user = await getUserWithPlan(userId)
  return user?.is_admin || false
}
```

```typescript
// lib/api/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

/**
 * 認証ミドルウェア
 */
export async function withAuth<T = any>(
  handler: (user: User, supabase: any) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    ) as NextResponse<T>
  }
  
  return handler(user, supabase)
}

/**
 * 管理者認証ミドルウェア
 */
export async function withAdminAuth<T = any>(
  handler: (user: User, supabase: any) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withAuth(async (user, supabase) => {
    const { checkIsAdmin } = await import('@/lib/utils/user-data')
    const isAdmin = await checkIsAdmin(user.id)
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      ) as NextResponse<T>
    }
    
    return handler(user, supabase)
  })
}
```

#### チェックリスト

- [ ] `lib/utils/user-data.ts`を作成
- [ ] `lib/api/middleware.ts`を作成
- [ ] 既存のAPIルートをリファクタリング（少なくとも5つ）
- [ ] 既存のページコンポーネントをリファクタリング（少なくとも3つ）
- [ ] テストして全機能が正常に動作することを確認

---

### 7. エラーハンドリングの統一

- [ ] **実装完了**
- **ファイル**: `lib/api/errors.ts`
- **実装時間**: 2-3時間
- **効果**: デバッグ効率 40%向上
- **難易度**: 中

#### 実装内容

```typescript
// lib/api/errors.ts
import { NextResponse } from 'next/server'

/**
 * APIエラークラス
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * エラーコード定義
 */
export const ERROR_CODES = {
  // 認証エラー
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // バリデーションエラー
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  
  // ビジネスロジックエラー
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',
  SEAT_NOT_AVAILABLE: 'SEAT_NOT_AVAILABLE',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  PAYMENT_METHOD_REQUIRED: 'PAYMENT_METHOD_REQUIRED',
  
  // システムエラー
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

/**
 * APIエラーハンドラー
 */
export function handleAPIError(error: unknown): NextResponse {
  // APIErrorの場合
  if (error instanceof APIError) {
    console.error(`[APIError] ${error.code}: ${error.message}`, error.details)
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    )
  }
  
  // 予期しないエラー
  console.error('[Unexpected Error]', error)
  return NextResponse.json(
    {
      error: 'サーバーエラーが発生しました',
      code: ERROR_CODES.INTERNAL_ERROR,
    },
    { status: 500 }
  )
}

/**
 * よく使うエラーのファクトリ関数
 */
export const createError = {
  unauthorized: (message = '認証が必要です') =>
    new APIError(401, message, ERROR_CODES.UNAUTHORIZED),
  
  forbidden: (message = '権限がありません') =>
    new APIError(403, message, ERROR_CODES.FORBIDDEN),
  
  invalidInput: (message: string, details?: any) =>
    new APIError(400, message, ERROR_CODES.INVALID_INPUT, details),
  
  alreadyCheckedIn: () =>
    new APIError(400, '既にチェックイン中です', ERROR_CODES.ALREADY_CHECKED_IN),
  
  notCheckedIn: () =>
    new APIError(400, 'チェックインしていません', ERROR_CODES.NOT_CHECKED_IN),
  
  seatNotAvailable: (reason?: string) =>
    new APIError(400, `座席が利用できません${reason ? `: ${reason}` : ''}`, ERROR_CODES.SEAT_NOT_AVAILABLE),
  
  bookingConflict: () =>
    new APIError(409, 'その時間は既に予約されています', ERROR_CODES.BOOKING_CONFLICT),
  
  paymentMethodRequired: () =>
    new APIError(400, 'カード情報が登録されていません', ERROR_CODES.PAYMENT_METHOD_REQUIRED),
}
```

#### チェックリスト

- [ ] `lib/api/errors.ts`を作成
- [ ] 既存のAPIルートでエラーハンドリングを統一（少なくとも10個）
- [ ] エラーコードが適切に返されることを確認
- [ ] フロントエンドでエラーコードに応じた適切なメッセージを表示
- [ ] エラーログが適切に記録されることを確認

---

### 8. 構造化ログの導入

- [ ] **実装完了**
- **ファイル**: `lib/logger.ts`
- **実装時間**: 2時間
- **効果**: デバッグ効率 50%向上、本番監視の強化
- **難易度**: 低

#### 実装内容

```typescript
// lib/logger.ts
import pino from 'pino'

/**
 * 構造化ログ
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * APIログヘルパー
 */
export function logAPIRequest(params: {
  method: string
  path: string
  userId?: string
  duration?: number
  status?: number
  error?: any
}) {
  const { method, path, userId, duration, status, error } = params
  
  if (error) {
    logger.error({
      type: 'api_request',
      method,
      path,
      userId,
      duration,
      status,
      error: error.message,
      stack: error.stack,
    }, `API Error: ${method} ${path}`)
  } else {
    logger.info({
      type: 'api_request',
      method,
      path,
      userId,
      duration,
      status,
    }, `API: ${method} ${path}`)
  }
}

/**
 * パフォーマンスログ
 */
export function logPerformance(params: {
  operation: string
  duration: number
  metadata?: any
}) {
  const { operation, duration, metadata } = params
  
  logger.info({
    type: 'performance',
    operation,
    duration,
    ...metadata,
  }, `Performance: ${operation} took ${duration}ms`)
}

/**
 * ビジネスイベントログ
 */
export function logEvent(params: {
  event: string
  userId?: string
  metadata?: any
}) {
  const { event, userId, metadata } = params
  
  logger.info({
    type: 'business_event',
    event,
    userId,
    ...metadata,
  }, `Event: ${event}`)
}
```

#### チェックリスト

- [ ] `pino`をインストール（`npm install pino`）
- [ ] `lib/logger.ts`を作成
- [ ] 主要なAPIルートでログを追加（チェックイン、決済、予約など）
- [ ] パフォーマンスログを追加（遅いクエリの検出）
- [ ] Vercelのログで構造化ログが確認できることをテスト

---

## 📝 完了記録

### Phase 1

- **開始日**: ____/__/__
- **完了日**: ____/__/__
- **所要時間**: ____時間
- **効果測定**:
  - リクエスト数: ______/日 → ______/日
  - ダッシュボード: ______ms → ______ms
  - 座席表: ______ms → ______ms

### Phase 2

- **開始日**: ____/__/__
- **完了日**: ____/__/__
- **所要時間**: ____時間
- **効果測定**:
  - クエリ数: ______回 → ______回
  - レスポンス: ______ms → ______ms

### Phase 3

- **開始日**: ____/__/__
- **完了日**: ____/__/__
- **所要時間**: ____時間
- **効果測定**:
  - コード行数削減: ______行
  - エラー検出速度向上: ______%

---

## 🎯 次のステップ（Phase 3以降）

これらは優先度は低いが、将来的に実装すると良い項目：

- [ ] React Query（TanStack Query）の導入 - キャッシュ管理の統一
- [ ] テストの追加（Jest + React Testing Library）
- [ ] Storybook導入 - コンポーネントのドキュメント化
- [ ] Sentry導入 - エラートラッキング
- [ ] Vercel Analytics導入 - パフォーマンス監視
- [ ] データエクスポート機能 - CSV/Excel出力
- [ ] データ分析ダッシュボード - チャート・グラフ表示

---

**最終更新日**: 2026年1月26日
