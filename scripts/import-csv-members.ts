/**
 * CSV会員データ → Supabase インポートスクリプト
 *
 * 6つのCSVファイルからメールアドレスと名前を抽出し、
 * 既存のSupabaseユーザーと照合して新規会員のみを追加する。
 *
 * 使い方:
 *   npx tsx scripts/import-csv-members.ts --dry-run   # 確認のみ
 *   npx tsx scripts/import-csv-members.ts              # 実行
 *
 * 環境変数(.env.local から読み込み):
 *   NEXT_PUBLIC_SUPABASE_URL  - Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// .env.local を読み込む
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ============================================
// CSV入力ディレクトリ
// ============================================
const CSV_DIR = '/Users/tsuruta/Documents/edith_output/input'

// ============================================
// 型定義
// ============================================
interface CsvMember {
  name: string
  nameKana: string
  email: string
  phone: string
  companyName: string
  source: string
  hasSharedOffice: boolean
  planText: string // 元のプラン情報（デバッグ用）
}

// ============================================
// CSVパーサー（ダブルクォート囲みのカンマ対応）
// ============================================
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        // 次の文字も " ならエスケープされたダブルクォート
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // 次の " をスキップ
        } else {
          // クォート終了
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  // 最後のフィールド
  fields.push(current.trim())

  return fields
}

/**
 * CSVファイルを読み込み、行を配列として返す。
 * 複数行にまたがるダブルクォートフィールドに対応する。
 */
function parseCsvFile(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const rows: string[][] = []
  let currentLine = ''
  let inQuotes = false

  for (const rawLine of content.split('\n')) {
    if (currentLine === '') {
      currentLine = rawLine
    } else {
      // 前の行のクォートが閉じていない場合、行をつなげる
      currentLine += '\n' + rawLine
    }

    // クォートの開閉を数える
    let quotes = 0
    for (const ch of currentLine) {
      if (ch === '"') quotes++
    }
    inQuotes = quotes % 2 !== 0

    if (!inQuotes) {
      // クォートが閉じたので、この行をパースする
      const line = currentLine.replace(/\r$/, '')
      if (line.trim() !== '') {
        rows.push(parseCsvLine(line))
      }
      currentLine = ''
    }
  }

  // 最後の行が残っている場合
  if (currentLine.trim() !== '') {
    rows.push(parseCsvLine(currentLine.replace(/\r$/, '')))
  }

  return rows
}

/**
 * ヘッダー行からカラムのインデックスを取得する。
 * 同名カラムが複数ある場合は最初のものを返す。
 */
function findColumnIndex(headers: string[], name: string): number {
  return headers.findIndex((h) => h === name)
}

/**
 * ヘッダー行から指定名のカラムのインデックスを全て返す。
 */
function findAllColumnIndices(headers: string[], name: string): number[] {
  const indices: number[] = []
  headers.forEach((h, i) => {
    if (h === name) indices.push(i)
  })
  return indices
}

/**
 * 名前から「様」「御中」を除去する。
 */
function cleanName(name: string): string {
  return name.replace(/[　\s]*(様|御中)$/g, '').trim()
}

/**
 * メールアドレスの正規化（小文字化・前後の空白除去）。
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * シェアオフィス系プランかどうかを判定する。
 *
 * 登録フォーム1.csv: プラン選択=「シェアオフィス」、登録プランに「ライト」「レギュラー」「起業家」
 * コワーキング.csv: 登録プランに「シェアオフィス」「ライト」「レギュラー」「起業家」
 */
function isSharedOfficePlan(planSelection: string, planTexts: string[]): boolean {
  // プラン選択が「シェアオフィス」なら確定
  if (planSelection.includes('シェアオフィス')) return true

  // 登録プランに特定キーワードが含まれるか
  for (const text of planTexts) {
    if (
      text.includes('シェアオフィス') ||
      text.includes('ライト') ||
      text.includes('レギュラー') ||
      text.includes('起業家')
    ) {
      return true
    }
  }

  return false
}

// ============================================
// 各CSVファイルのパーサー
// ============================================

/**
 * 登録フォーム1.csv
 * ヘッダー: タイムスタンプ,お名前,お名前（ふりがな）,メールアドレス,電話番号,...,プラン選択,登録プラン,...,会社名・屋号・団体名,...,登録プラン(2nd),...
 */
function parseRegistrationForm(filePath: string): CsvMember[] {
  const rows = parseCsvFile(filePath)
  if (rows.length < 2) return []

  const headers = rows[0]
  const nameIdx = findColumnIndex(headers, 'お名前')
  const kanaIdx = findColumnIndex(headers, 'お名前（ふりがな）')
  const emailIndices = findAllColumnIndices(headers, 'メールアドレス')
  const emailIdx = emailIndices[0] // 最初のメールアドレスを使用
  const phoneIdx = findColumnIndex(headers, '電話番号')
  const companyIdx = findColumnIndex(headers, '会社名・屋号・団体名')
  const planSelIdx = findColumnIndex(headers, 'プラン選択')
  const planIndices = findAllColumnIndices(headers, '登録プラン')

  // 支払方法（クレジットカード以外のみ対象）
  const payMethodIndices = findAllColumnIndices(headers, '支払方法')

  const members: CsvMember[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const email = emailIdx >= 0 && emailIdx < row.length ? normalizeEmail(row[emailIdx]) : ''
    if (!email || !email.includes('@')) continue

    const name = nameIdx >= 0 && nameIdx < row.length ? cleanName(row[nameIdx]) : ''
    if (!name) continue

    // クレジットカード払いの人はStripeにいるのでスキップ
    const payMethods = payMethodIndices.map((idx) => (idx < row.length ? row[idx] : ''))
    if (payMethods.some((pm) => pm.includes('クレジットカード'))) continue

    const planSelection = planSelIdx >= 0 && planSelIdx < row.length ? row[planSelIdx] : ''
    const planTexts = planIndices.map((idx) => (idx < row.length ? row[idx] : ''))

    members.push({
      name,
      nameKana: kanaIdx >= 0 && kanaIdx < row.length ? row[kanaIdx] : '',
      email,
      phone: phoneIdx >= 0 && phoneIdx < row.length ? row[phoneIdx] : '',
      companyName: companyIdx >= 0 && companyIdx < row.length ? row[companyIdx] : '',
      source: '登録フォーム1.csv',
      hasSharedOffice: isSharedOfficePlan(planSelection, planTexts),
      planText: [planSelection, ...planTexts].filter(Boolean).join(' / '),
    })
  }

  return members
}

/**
 * バーチャルオフィス1.csv
 * ヘッダー: タイムスタンプ,お名前,お名前（ふりがな）,性別,会社名・屋号・団体名,...,メールアドレス,...
 * バーチャルオフィスは住所利用なのでシェアオフィス扱い
 */
function parseVirtualOffice1(filePath: string): CsvMember[] {
  const rows = parseCsvFile(filePath)
  if (rows.length < 2) return []

  const headers = rows[0]
  const nameIdx = findColumnIndex(headers, 'お名前')
  const kanaIdx = findColumnIndex(headers, 'お名前（ふりがな）')
  const emailIdx = findColumnIndex(headers, 'メールアドレス')
  const phoneIdx = findColumnIndex(headers, '電話番号')
  const companyIdx = findColumnIndex(headers, '会社名・屋号・団体名')

  const payMethodIdx = findColumnIndex(headers, '支払方法')

  const members: CsvMember[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const email = emailIdx >= 0 && emailIdx < row.length ? normalizeEmail(row[emailIdx]) : ''
    if (!email || !email.includes('@')) continue

    const name = nameIdx >= 0 && nameIdx < row.length ? cleanName(row[nameIdx]) : ''
    if (!name) continue

    // クレジットカード払いはスキップ
    const payMethod = payMethodIdx >= 0 && payMethodIdx < row.length ? row[payMethodIdx] : ''
    if (payMethod.includes('クレジットカード')) continue

    members.push({
      name,
      nameKana: kanaIdx >= 0 && kanaIdx < row.length ? row[kanaIdx] : '',
      email,
      phone: phoneIdx >= 0 && phoneIdx < row.length ? row[phoneIdx] : '',
      companyName: companyIdx >= 0 && companyIdx < row.length ? row[companyIdx] : '',
      source: 'バーチャルオフィス1.csv',
      hasSharedOffice: true, // バーチャルオフィス = 住所利用
      planText: 'バーチャルオフィス',
    })
  }

  return members
}

/**
 * バーチャルオフィス2.csv
 * ヘッダー: タイムスタンプ,お名前,お名前（ふりがな）,会社名・屋号・団体名等,性別,メールアドレス,...
 * バーチャルオフィスは住所利用なのでシェアオフィス扱い
 */
function parseVirtualOffice2(filePath: string): CsvMember[] {
  const rows = parseCsvFile(filePath)
  if (rows.length < 2) return []

  const headers = rows[0]
  const nameIdx = findColumnIndex(headers, 'お名前')
  const kanaIdx = findColumnIndex(headers, 'お名前（ふりがな）')
  const emailIdx = findColumnIndex(headers, 'メールアドレス')
  const phoneIdx = findColumnIndex(headers, '電話番号')
  const companyIdx = findColumnIndex(headers, '会社名・屋号・団体名等')

  const payMethodIdx = findColumnIndex(headers, '支払方法')

  const members: CsvMember[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const email = emailIdx >= 0 && emailIdx < row.length ? normalizeEmail(row[emailIdx]) : ''
    if (!email || !email.includes('@')) continue

    const name = nameIdx >= 0 && nameIdx < row.length ? cleanName(row[nameIdx]) : ''
    if (!name) continue

    // クレジットカード払いはスキップ
    const payMethod = payMethodIdx >= 0 && payMethodIdx < row.length ? row[payMethodIdx] : ''
    if (payMethod.includes('クレジットカード')) continue

    members.push({
      name,
      nameKana: kanaIdx >= 0 && kanaIdx < row.length ? row[kanaIdx] : '',
      email,
      phone: phoneIdx >= 0 && phoneIdx < row.length ? row[phoneIdx] : '',
      companyName: companyIdx >= 0 && companyIdx < row.length ? row[companyIdx] : '',
      source: 'バーチャルオフィス2.csv',
      hasSharedOffice: true, // バーチャルオフィス = 住所利用
      planText: 'バーチャルオフィス',
    })
  }

  return members
}

/**
 * paypay.csv
 * ヘッダー: 名前,メールアドレス,サブスク開始日,サブスク終了日,ステータス,月額料金,プラン名,取引件数
 * ステータスが「終了」の人はスキップ。「継続中」のみ対象。
 */
function parsePayPay(filePath: string): CsvMember[] {
  const rows = parseCsvFile(filePath)
  if (rows.length < 2) return []

  const headers = rows[0]
  const nameIdx = findColumnIndex(headers, '名前')
  const emailIdx = findColumnIndex(headers, 'メールアドレス')
  const statusIdx = findColumnIndex(headers, 'ステータス')
  const planIdx = findColumnIndex(headers, 'プラン名')

  const members: CsvMember[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const status = statusIdx >= 0 && statusIdx < row.length ? row[statusIdx] : ''
    if (status !== '継続中') continue // 「終了」はスキップ

    const email = emailIdx >= 0 && emailIdx < row.length ? normalizeEmail(row[emailIdx]) : ''
    if (!email || !email.includes('@')) continue

    const name = nameIdx >= 0 && nameIdx < row.length ? cleanName(row[nameIdx]) : ''
    if (!name) continue

    const planName = planIdx >= 0 && planIdx < row.length ? row[planIdx] : ''

    members.push({
      name,
      nameKana: '',
      email,
      phone: '',
      companyName: '',
      source: 'paypay.csv',
      hasSharedOffice: false, // PayPayサブスクはコワーキング利用
      planText: planName,
    })
  }

  return members
}

/**
 * 会費ペイ.csv
 * ヘッダー: 会員番号,名前,フリガナ,メールアドレス,...,ステータス,...
 * ステータスが「退会」の人はスキップ。
 */
function parseKaihiPay(filePath: string): CsvMember[] {
  const rows = parseCsvFile(filePath)
  if (rows.length < 2) return []

  const headers = rows[0]
  const nameIdx = findColumnIndex(headers, '名前')
  const kanaIdx = findColumnIndex(headers, 'フリガナ')
  const emailIdx = findColumnIndex(headers, 'メールアドレス')
  const phoneIdx = findColumnIndex(headers, '電話番号')
  const companyIdx = findColumnIndex(headers, '会社名')
  const statusIdx = findColumnIndex(headers, 'ステータス')
  const planIdx = findColumnIndex(headers, 'プラン名')

  const members: CsvMember[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const status = statusIdx >= 0 && statusIdx < row.length ? row[statusIdx] : ''
    if (status === '退会') continue // 退会はスキップ

    const email = emailIdx >= 0 && emailIdx < row.length ? normalizeEmail(row[emailIdx]) : ''
    if (!email || !email.includes('@')) continue

    const name = nameIdx >= 0 && nameIdx < row.length ? cleanName(row[nameIdx]) : ''
    if (!name) continue

    const planName = planIdx >= 0 && planIdx < row.length ? row[planIdx] : ''

    members.push({
      name,
      nameKana: kanaIdx >= 0 && kanaIdx < row.length ? row[kanaIdx] : '',
      email,
      phone: phoneIdx >= 0 && phoneIdx < row.length ? row[phoneIdx] : '',
      companyName: companyIdx >= 0 && companyIdx < row.length ? row[companyIdx] : '',
      source: '会費ペイ.csv',
      hasSharedOffice: isSharedOfficePlan('', [planName]),
      planText: planName,
    })
  }

  return members
}

/**
 * コワーキング.csv
 * ヘッダー: タイムスタンプ,名前,名前（ふりがな）,性別,メールアドレス,電話番号,登録プラン,...,メールアドレス
 */
function parseCoworking(filePath: string): CsvMember[] {
  const rows = parseCsvFile(filePath)
  if (rows.length < 2) return []

  const headers = rows[0]
  const nameIdx = findColumnIndex(headers, '名前')
  const kanaIdx = findColumnIndex(headers, '名前（ふりがな）')
  const emailIndices = findAllColumnIndices(headers, 'メールアドレス')
  const emailIdx = emailIndices[0] // 最初のメールアドレスを使用
  const phoneIdx = findColumnIndex(headers, '電話番号')
  const planIdx = findColumnIndex(headers, '登録プラン')

  const payMethodIdx = findColumnIndex(headers, '支払方法')

  const members: CsvMember[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const email = emailIdx >= 0 && emailIdx < row.length ? normalizeEmail(row[emailIdx]) : ''
    if (!email || !email.includes('@')) continue

    const name = nameIdx >= 0 && nameIdx < row.length ? cleanName(row[nameIdx]) : ''
    if (!name) continue

    // クレジットカード払いはスキップ
    const payMethod = payMethodIdx >= 0 && payMethodIdx < row.length ? row[payMethodIdx] : ''
    if (payMethod.includes('クレジットカード')) continue

    const planText = planIdx >= 0 && planIdx < row.length ? row[planIdx] : ''

    members.push({
      name,
      nameKana: kanaIdx >= 0 && kanaIdx < row.length ? row[kanaIdx] : '',
      email,
      phone: phoneIdx >= 0 && phoneIdx < row.length ? row[phoneIdx] : '',
      companyName: '',
      source: 'コワーキング.csv',
      hasSharedOffice: isSharedOfficePlan('', [planText]),
      planText,
    })
  }

  return members
}

// ============================================
// メイン処理
// ============================================
async function main() {
  // 環境変数チェック
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase環境変数が設定されていません')
    console.error('必要: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log(`=== CSV会員インポート（${DRY_RUN ? 'ドライラン' : '実行'}） ===\n`)

  // ============================================
  // Step 1: 全CSVファイルを読み込む
  // ============================================
  const csvFiles: { file: string; parser: (path: string) => CsvMember[] }[] = [
    { file: '登録フォーム1.csv', parser: parseRegistrationForm },
    { file: 'バーチャルオフィス1.csv', parser: parseVirtualOffice1 },
    { file: 'バーチャルオフィス2.csv', parser: parseVirtualOffice2 },
    { file: 'paypay.csv', parser: parsePayPay },
    { file: '会費ペイ.csv', parser: parseKaihiPay },
    { file: 'コワーキング.csv', parser: parseCoworking },
  ]

  const allMembers: CsvMember[] = []
  const countPerFile: Record<string, number> = {}

  console.log('=== CSV読み込み結果 ===')
  for (const { file, parser } of csvFiles) {
    const filePath = path.join(CSV_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.log(`${file}: ファイルが見つかりません（スキップ）`)
      countPerFile[file] = 0
      continue
    }

    const members = parser(filePath)
    allMembers.push(...members)
    countPerFile[file] = members.length
    console.log(`${file}: ${members.length}件`)
  }

  console.log(`\n合計: ${allMembers.length}件\n`)

  // ============================================
  // Step 1.5: 退会者メールを収集（他CSVからの混入を防ぐ）
  // paypay.csv の「終了」、会費ペイ.csv の「退会」を退会者リストにする
  // ============================================
  const cancelledEmails = new Set<string>()

  // paypay.csv の終了者
  const paypayPath = path.join(CSV_DIR, 'paypay.csv')
  if (fs.existsSync(paypayPath)) {
    const rows = parseCsvFile(paypayPath)
    if (rows.length > 1) {
      const headers = rows[0]
      const emailIdx = findColumnIndex(headers, 'メールアドレス')
      const statusIdx = findColumnIndex(headers, 'ステータス')
      for (let i = 1; i < rows.length; i++) {
        const status = statusIdx >= 0 && statusIdx < rows[i].length ? rows[i][statusIdx] : ''
        const email = emailIdx >= 0 && emailIdx < rows[i].length ? normalizeEmail(rows[i][emailIdx]) : ''
        if (status === '終了' && email.includes('@')) cancelledEmails.add(email)
      }
    }
  }

  // 会費ペイ.csv の退会者
  const kaihiPath = path.join(CSV_DIR, '会費ペイ.csv')
  if (fs.existsSync(kaihiPath)) {
    const rows = parseCsvFile(kaihiPath)
    if (rows.length > 1) {
      const headers = rows[0]
      const emailIdx = findColumnIndex(headers, 'メールアドレス')
      const statusIdx = findColumnIndex(headers, 'ステータス')
      for (let i = 1; i < rows.length; i++) {
        const status = statusIdx >= 0 && statusIdx < rows[i].length ? rows[i][statusIdx] : ''
        const email = emailIdx >= 0 && emailIdx < rows[i].length ? normalizeEmail(rows[i][emailIdx]) : ''
        if (status === '退会' && email.includes('@')) cancelledEmails.add(email)
      }
    }
  }

  console.log(`退会者リスト: ${cancelledEmails.size}件（他CSVから除外）\n`)

  // ============================================
  // Step 2: メールアドレスで重複排除
  // 同じメールが複数CSVに出現する場合、最初に見つかったものを採用
  // ただし、hasSharedOffice が true のものを優先する
  // 退会者リストに含まれる人は除外する
  // ============================================
  const uniqueMap = new Map<string, CsvMember>()

  for (const member of allMembers) {
    // 退会者リストに含まれる場合はスキップ
    if (cancelledEmails.has(member.email)) continue

    const existing = uniqueMap.get(member.email)
    if (!existing) {
      uniqueMap.set(member.email, member)
    } else {
      // hasSharedOffice が true のものを優先
      if (!existing.hasSharedOffice && member.hasSharedOffice) {
        uniqueMap.set(member.email, { ...member })
      }
      // 名前カナが空なら補完
      if (!existing.nameKana && member.nameKana) {
        existing.nameKana = member.nameKana
      }
      // 電話番号が空なら補完
      if (!existing.phone && member.phone) {
        existing.phone = member.phone
      }
      // 会社名が空なら補完
      if (!existing.companyName && member.companyName) {
        existing.companyName = member.companyName
      }
    }
  }

  const uniqueMembers = Array.from(uniqueMap.values())

  console.log('=== 重複排除後 ===')
  console.log(`ユニークなメールアドレス: ${uniqueMembers.length}件\n`)

  // ============================================
  // Step 3: 既存のSupabaseユーザーと照合
  // ============================================
  console.log('Supabase既存ユーザーを取得中...')

  // ユーザーが多い場合に備え、全件取得する
  const { data: existingUsers, error: fetchError } = await supabase
    .from('users')
    .select('email')

  if (fetchError) {
    console.error('既存ユーザー取得エラー:', fetchError.message)
    process.exit(1)
  }

  const existingEmails = new Set(
    (existingUsers || []).map((u) => normalizeEmail(u.email))
  )

  // Auth側のユーザーも確認（usersテーブルにないがAuthに存在するケース）
  const authEmails = new Set<string>()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data: authList, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })
    if (authError) {
      console.error('Authユーザー取得エラー:', authError.message)
      break
    }
    if (!authList || authList.users.length === 0) break
    for (const u of authList.users) {
      if (u.email) authEmails.add(normalizeEmail(u.email))
    }
    if (authList.users.length < perPage) break
    page++
  }

  // 両方のセットを合わせる
  const allExistingEmails = new Set([...existingEmails, ...authEmails])

  const newMembers = uniqueMembers.filter((m) => !allExistingEmails.has(m.email))
  const skippedMembers = uniqueMembers.filter((m) => allExistingEmails.has(m.email))

  console.log('\n=== DB照合 ===')
  console.log(`既存ユーザー: ${skippedMembers.length}件（スキップ）`)
  console.log(`新規追加対象: ${newMembers.length}件\n`)

  if (newMembers.length === 0) {
    console.log('新規追加対象がありません。終了します。')
    return
  }

  // ============================================
  // Step 4: 新規追加リスト表示
  // ============================================
  console.log('=== 新規追加リスト ===')
  for (let i = 0; i < newMembers.length; i++) {
    const m = newMembers[i]
    const sharedOffice = m.hasSharedOffice ? 'Yes' : 'No'
    console.log(
      `${i + 1}. ${m.name} <${m.email}> | ソース: ${m.source} | シェアオフィス: ${sharedOffice}` +
      (m.planText ? ` | プラン: ${m.planText}` : '')
    )
  }

  // ============================================
  // Step 5: ドライランなら結果のみ出力して終了
  // ============================================
  if (DRY_RUN) {
    console.log(`\n=== 結果（ドライラン） ===`)
    console.log(`追加予定: ${newMembers.length}件`)
    console.log(`スキップ: ${skippedMembers.length}件`)
    return
  }

  // ============================================
  // Step 6: Supabase Auth作成 + usersテーブル更新
  // ============================================
  console.log('\n=== Supabase登録開始 ===\n')

  let created = 0
  let errors = 0

  for (const m of newMembers) {
    // Auth ユーザー作成
    const tempPassword = `Room8_${Math.random().toString(36).slice(2, 10)}`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: m.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: m.name,
        imported_from: 'csv',
      },
    })

    if (authError) {
      console.error(`  ${m.name} <${m.email}> → Auth作成エラー: ${authError.message}`)
      errors++
      continue
    }

    const userId = authData.user.id

    // users テーブル更新（トリガーで作成済みのレコードを更新）
    const isIndividual = !m.companyName || m.companyName === '無し' || m.companyName === 'なし'

    const updateData: Record<string, any> = {
      name: m.name,
      member_type: 'regular',
      is_individual: isIndividual,
      status: 'active',
      has_shared_office: m.hasSharedOffice,
      membership_note: `CSVインポート(${m.source}) ${new Date().toISOString().split('T')[0]}`,
    }

    // オプションフィールド
    if (m.nameKana) updateData.name_kana = m.nameKana
    if (m.phone) updateData.phone = m.phone
    if (m.companyName && m.companyName !== '無し' && m.companyName !== 'なし') {
      updateData.company_name = m.companyName
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error(`  ${m.name} <${m.email}> → users更新エラー: ${updateError.message}`)
      errors++
      continue
    }

    console.log(`  ${m.name} <${m.email}> → 登録OK (userId: ${userId})`)
    created++
  }

  // ============================================
  // Step 7: 結果出力
  // ============================================
  console.log(`\n=== 結果 ===`)
  console.log(`追加: ${created}件`)
  console.log(`スキップ: ${skippedMembers.length}件`)
  console.log(`エラー: ${errors}件`)
}

main().catch((err) => {
  console.error('予期しないエラー:', err)
  process.exit(1)
})
