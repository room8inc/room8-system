import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Room8 ナレッジベース
 * data/room8-knowledge.md から読み込み、LLMのシステムプロンプトに渡す
 */
export const ROOM8_KNOWLEDGE = readFileSync(
  join(process.cwd(), 'data', 'room8-knowledge.md'),
  'utf-8'
)
