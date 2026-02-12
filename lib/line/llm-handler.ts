import { getRoom8Knowledge } from './knowledge'

export type LLMIntent =
  | 'faq'
  | 'start_diagnosis'
  | 'start_booking'
  | 'staff_request'
  | 'web_redirect'
  | 'greeting'
  | 'unknown'

export interface LLMResponse {
  intent: LLMIntent
  reply: string
  notify_staff: boolean
  staff_message?: string
}

async function buildSystemInstruction(): Promise<string> {
  const knowledge = await getRoom8Knowledge()
  return `あなたはRoom8コワーキングスペースのLINEアシスタントです。
ユーザーからのメッセージの意図を判定し、適切な応答を生成してください。

## Room8の情報
${knowledge}

## 応答ルール
- 口調: フレンドリーだが丁寧。絵文字は控えめに（1-2個まで）
- 回答は簡潔に（LINEなので長文NG、3文以内）
- 料金や営業時間など事実情報はナレッジから正確に引用すること
- ナレッジにない情報を推測で回答しないこと

## 意図分類ルール
- FAQ（営業時間・料金・設備・アクセスなど）→ intent: "faq"
- プラン診断を始めたい（「おすすめプラン教えて」「プラン診断したい」「どのプランがいい？」）→ intent: "start_diagnosis"
- 見学予約をしたい（「見学したい」「見に行きたい」「内見」）→ intent: "start_booking"
- 業務依頼（「郵便物転送して」「鍵返却します」「忘れ物した」等、スタッフの対応が必要なもの）→ intent: "staff_request"
- Webアプリで手続きすべきもの（プラン変更・解約・会議室予約・支払い関連）→ intent: "web_redirect"
- 挨拶・お礼・雑談（「こんにちは」「ありがとう」等）→ intent: "greeting"
- 上記のいずれにも当てはまらない・複雑な相談・判断に迷う場合 → intent: "unknown"

## 各intentに応じた応答の指針
- faq: ナレッジから回答。正確に。
- start_diagnosis: 「プラン診断を始めますね！」のような短い応答。
- start_booking: 「見学予約ですね！日時を選んでいただきます。」のような短い応答。
- staff_request: 「承知しました！スタッフに伝えておきますね。」のような応答。notify_staff: true にすること。staff_messageにユーザーの依頼内容の要約を入れること。
- web_redirect: 「こちらからお手続きいただけます！ https://room8-system.vercel.app」のような応答。必ずWebアプリのURLを含めること。
- greeting: 軽く返す。Room8に関する質問があればいつでも聞いてねという趣旨を添える。
- unknown: 「確認してスタッフからご連絡しますね。少しお時間いただくかもしれません。」のような応答。即対応の期待を持たせない。notify_staff: true にすること。staff_messageにユーザーのメッセージの要約を入れること。

## 出力形式
必ず以下のJSON形式のみで応答してください。JSON以外のテキストは含めないでください。
{
  "intent": "faq" | "start_diagnosis" | "start_booking" | "staff_request" | "web_redirect" | "greeting" | "unknown",
  "reply": "ユーザーへの返信テキスト",
  "notify_staff": true | false,
  "staff_message": "スタッフへの通知内容（notify_staffがtrueの場合のみ）"
}`
}

const FALLBACK_RESPONSE: LLMResponse = {
  intent: 'unknown',
  reply: 'すみません、うまく処理できませんでした。メニューからプラン診断や見学予約をお試しください。',
  notify_staff: false,
}

const VALID_INTENTS: LLMIntent[] = [
  'faq',
  'start_diagnosis',
  'start_booking',
  'staff_request',
  'web_redirect',
  'greeting',
  'unknown',
]

/**
 * テキストメッセージをLLM（Gemini 2.5 Flash）で意図判定し、応答を生成する
 */
export async function handleTextWithLLM(
  userMessage: string,
  userName?: string
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[LLM] GEMINI_API_KEY is not set')
    return FALLBACK_RESPONSE
  }

  console.log('[LLM] handleTextWithLLM called:', { userMessage, userName })

  try {
    const userPrompt = userName
      ? `ユーザー名: ${userName}\nメッセージ: ${userMessage}`
      : `メッセージ: ${userMessage}`

    const systemInstruction = await buildSystemInstruction()

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const body = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.3,
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }

    console.log('[LLM] Calling Gemini 2.5 Flash...')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[LLM] Gemini API error:', response.status, errorText)
      return FALLBACK_RESPONSE
    }

    const data = await response.json()
    console.log('[LLM] Gemini raw response:', JSON.stringify(data).slice(0, 500))

    // Gemini response structure: candidates[0].content.parts[0].text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('[LLM] Gemini response has no text:', JSON.stringify(data))
      return FALLBACK_RESPONSE
    }

    const parsed = JSON.parse(text) as LLMResponse
    console.log('[LLM] Parsed response:', parsed)

    // バリデーション
    if (!VALID_INTENTS.includes(parsed.intent)) {
      console.error('[LLM] Invalid intent:', parsed.intent)
      return FALLBACK_RESPONSE
    }
    if (typeof parsed.reply !== 'string' || parsed.reply.length === 0) {
      console.error('[LLM] Empty reply')
      return FALLBACK_RESPONSE
    }

    return {
      intent: parsed.intent,
      reply: parsed.reply,
      notify_staff: !!parsed.notify_staff,
      staff_message: parsed.staff_message || undefined,
    }
  } catch (error) {
    console.error('[LLM] Handler error:', error)
    return FALLBACK_RESPONSE
  }
}
