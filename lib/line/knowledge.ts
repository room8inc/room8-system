/**
 * Room8 ナレッジベース
 * DB優先、失敗時は静的MDにフォールバック
 */
import knowledgeContent from '../../data/room8-knowledge.md'
import { getKnowledgeFromDB } from './knowledge-db'

/** 静的フォールバック用 */
export const ROOM8_KNOWLEDGE: string = knowledgeContent

/**
 * ナレッジを取得する（DB優先、失敗時は静的MD）
 */
export async function getRoom8Knowledge(): Promise<string> {
  try {
    return await getKnowledgeFromDB()
  } catch (error) {
    console.error('[Knowledge] DB取得失敗、静的MDにフォールバック:', error)
    return ROOM8_KNOWLEDGE
  }
}
