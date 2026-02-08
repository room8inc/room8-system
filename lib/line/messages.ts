import type { messagingApi } from '@line/bot-sdk'
import type { PlanInfo, NeedsAddress } from './types'
import { formatPrice, getPriceDisplay } from './plan-recommend'

type Message = messagingApi.Message

export function welcomeMessage(): Message {
  return {
    type: 'text',
    text: 'Room8コワーキングスペースへようこそ！🏢\nプラン診断で、あなたにぴったりのプランを見つけましょう。',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🔍 プラン診断',
            data: 'action=start_diagnosis',
            displayText: 'プラン診断を始める',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📅 見学予約',
            data: 'usage=tour',
            displayText: 'まずは見学したい',
          },
        },
      ],
    },
  }
}

export function askUsageMessage(): Message {
  return {
    type: 'text',
    text: 'Room8をどのように使いたいですか？',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🕐 ドロップイン',
            data: 'usage=dropin',
            displayText: 'ドロップインで使いたい',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📋 月額利用',
            data: 'usage=monthly',
            displayText: '月額プランで利用したい',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '👀 まずは見学',
            data: 'usage=tour',
            displayText: 'まずは見学したい',
          },
        },
      ],
    },
  }
}

export function askTimeMessage(): Message {
  return {
    type: 'text',
    text: 'いつ使うことが多いですか？',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '☀️ 平日日中',
            data: 'time=day',
            displayText: '平日の日中',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🌙 平日夜',
            data: 'time=night',
            displayText: '平日の夜',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🗓 土日祝',
            data: 'time=weekend',
            displayText: '土日祝',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '☀️🌙 平日日中+夜',
            data: 'time=weekday',
            displayText: '平日の日中と夜',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🌙🗓 平日夜+土日祝',
            data: 'time=night-weekend',
            displayText: '平日夜と土日祝',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📅 全営業時間',
            data: 'time=regular',
            displayText: '全営業時間',
          },
        },
      ],
    },
  }
}

export function askAddressMessage(): Message {
  return {
    type: 'text',
    text: '住所利用（登記・届出用）は必要ですか？',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '✅ はい',
            data: 'address=yes',
            displayText: 'はい、必要です',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '❌ いいえ',
            data: 'address=no',
            displayText: 'いいえ、不要です',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🤔 わからない',
            data: 'address=unknown',
            displayText: 'わからない',
          },
        },
      ],
    },
  }
}

export function dropinMessage(): Message[] {
  const flexMessage: Message = {
    type: 'flex',
    altText: 'ドロップイン料金のご案内',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 ドロップイン',
            weight: 'bold',
            size: 'xl',
            color: '#1a1a2e',
          },
        ],
        backgroundColor: '#f0f4ff',
        paddingAll: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '1時間あたり',
            size: 'sm',
            color: '#888888',
          },
          {
            type: 'text',
            text: '¥420',
            weight: 'bold',
            size: 'xxl',
            color: '#1a1a2e',
            margin: 'sm',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: '• 1日最大 ¥2,200',
                size: 'sm',
                color: '#555555',
              },
              {
                type: 'text',
                text: '• Wi-Fi・電源・フリードリンク付き',
                size: 'sm',
                color: '#555555',
                margin: 'sm',
              },
              {
                type: 'text',
                text: '• 予約不要。営業時間内にお越しください',
                size: 'sm',
                color: '#555555',
                margin: 'sm',
              },
            ],
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: '📍 愛知県春日井市勝川町7-37',
                size: 'xs',
                color: '#888888',
              },
              {
                type: 'text',
                text: '   ネクシティパレッタ 1F',
                size: 'xs',
                color: '#888888',
              },
              {
                type: 'text',
                text: '🚃 JR勝川駅 徒歩3分',
                size: 'xs',
                color: '#888888',
                margin: 'sm',
              },
              {
                type: 'text',
                text: '🕐 平日 9:00-22:00 / 土日祝 9:00-17:00',
                size: 'xs',
                color: '#888888',
                margin: 'sm',
              },
            ],
          },
        ],
        paddingAll: '20px',
      },
    },
  }

  const followUp: Message = {
    type: 'text',
    text: '見学も承っております。お気軽にどうぞ！',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📅 見学予約する',
            data: 'book=yes',
            displayText: '見学を予約する',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🙏 結構です',
            data: 'book=no',
            displayText: '大丈夫です',
          },
        },
      ],
    },
  }

  return [flexMessage, followUp]
}

export function planResultMessage(plan: PlanInfo, needsAddress: NeedsAddress): Message[] {
  const priceText = getPriceDisplay(plan, needsAddress)
  const showPrice = needsAddress === 'yes' ? plan.addressPrice : plan.basePrice

  const flexMessage: Message = {
    type: 'flex',
    altText: `おすすめプラン: ${plan.name}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✨ おすすめプラン',
            size: 'sm',
            color: '#666666',
          },
          {
            type: 'text',
            text: `${plan.name}プラン`,
            weight: 'bold',
            size: 'xl',
            color: '#1a1a2e',
            margin: 'sm',
          },
        ],
        backgroundColor: '#f0f4ff',
        paddingAll: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: priceText,
            weight: 'bold',
            size: 'lg',
            color: '#1a1a2e',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: '利用時間',
                    size: 'sm',
                    color: '#888888',
                    flex: 3,
                  },
                  {
                    type: 'text',
                    text: plan.timeRange,
                    size: 'sm',
                    color: '#333333',
                    flex: 7,
                    wrap: true,
                  },
                ],
              },
              ...(needsAddress === 'unknown'
                ? [
                    {
                      type: 'box' as const,
                      layout: 'horizontal' as const,
                      margin: 'md' as const,
                      contents: [
                        {
                          type: 'text' as const,
                          text: '住所利用',
                          size: 'sm' as const,
                          color: '#888888',
                          flex: 3,
                        },
                        {
                          type: 'text' as const,
                          text: `+${formatPrice(plan.addressPrice - plan.basePrice)}/月`,
                          size: 'sm' as const,
                          color: '#333333',
                          flex: 7,
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: '• Wi-Fi・電源・フリードリンク付き',
                size: 'sm',
                color: '#555555',
              },
              {
                type: 'text',
                text: '• 複合機利用可',
                size: 'sm',
                color: '#555555',
                margin: 'sm',
              },
              {
                type: 'text',
                text: '• 登記・届出の住所利用オプション',
                size: 'sm',
                color: '#555555',
                margin: 'sm',
              },
            ],
          },
        ],
        paddingAll: '20px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📍 春日井市勝川町7-37 ネクシティパレッタ1F',
            size: 'xs',
            color: '#888888',
            align: 'center',
          },
          {
            type: 'text',
            text: '🚃 JR勝川駅 徒歩3分',
            size: 'xs',
            color: '#888888',
            align: 'center',
            margin: 'sm',
          },
        ],
        paddingAll: '15px',
      },
    },
  }

  const followUp: Message = {
    type: 'text',
    text: '実際の雰囲気を見てみませんか？見学は無料です！',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📅 見学予約する',
            data: 'book=yes',
            displayText: '見学を予約する',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🙏 結構です',
            data: 'book=no',
            displayText: '大丈夫です',
          },
        },
      ],
    },
  }

  return [flexMessage, followUp]
}

export function askBookingDatetimeMessage(): Message {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30)

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  return {
    type: 'text',
    text: 'ご希望の見学日時を選択してください。\n（所要時間は約30分です）',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'datetimepicker',
            label: '📅 日時を選ぶ',
            data: 'action=pick_datetime',
            mode: 'datetime',
            initial: `${formatDate(tomorrow)}T11:00`,
            min: `${formatDate(tomorrow)}T09:00`,
            max: `${formatDate(maxDate)}T21:00`,
          },
        },
      ],
    },
  }
}

export function bookingConfirmMessage(datetime: string): Message {
  const d = new Date(datetime)
  const dateStr = d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const timeStr = d.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return {
    type: 'flex',
    altText: '見学予約が完了しました',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '✅ 見学予約完了',
            weight: 'bold',
            size: 'xl',
            color: '#1a7a3a',
          },
        ],
        backgroundColor: '#e8f5e9',
        paddingAll: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '日時', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: `${dateStr} ${timeStr}`, size: 'sm', color: '#333333', flex: 5, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: '所要時間', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: '約30分', size: 'sm', color: '#333333', flex: 5 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: '場所', size: 'sm', color: '#888888', flex: 2 },
              { type: 'text', text: 'Room8（JR勝川駅 徒歩3分）', size: 'sm', color: '#333333', flex: 5, wrap: true },
            ],
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'text',
            text: '当日はお気軽にお越しください。\nご不明点はこちらのLINEでお問い合わせいただけます。',
            size: 'xs',
            color: '#888888',
            margin: 'lg',
            wrap: true,
          },
        ],
        paddingAll: '20px',
      },
    },
  }
}

export function bookingErrorMessage(): Message {
  return {
    type: 'text',
    text: '申し訳ございません。予約処理中にエラーが発生しました。\nお手数ですが、こちらのLINEで直接ご希望の日時をお知らせください。スタッフが対応いたします。',
  }
}

export function resetMessage(): Message {
  return {
    type: 'text',
    text: 'ありがとうございます！\nまたいつでもお気軽にご連絡ください 😊',
  }
}

export function fallbackMessage(): Message {
  return {
    type: 'text',
    text: 'メニューから選択してください。\nプラン診断や見学予約はいつでも始められます！',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🔍 プラン診断',
            data: 'action=start_diagnosis',
            displayText: 'プラン診断を始める',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📅 見学予約',
            data: 'usage=tour',
            displayText: '見学を予約したい',
          },
        },
      ],
    },
  }
}
