import { messagingApi } from '@line/bot-sdk'

let clientInstance: messagingApi.MessagingApiClient | null = null

export function getLineClient(): messagingApi.MessagingApiClient {
  if (clientInstance) return clientInstance

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelAccessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')
  }

  clientInstance = new messagingApi.MessagingApiClient({ channelAccessToken })
  return clientInstance
}
