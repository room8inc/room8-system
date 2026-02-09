/**
 * Room8 ナレッジベース
 * data/room8-knowledge.md から読み込み、LLMのシステムプロンプトに渡す
 */
import knowledgeContent from '../../data/room8-knowledge.md'

export const ROOM8_KNOWLEDGE: string = knowledgeContent
