/**
 * 名前を表示用にフォーマットする
 * DBには既に「姓 名」順で格納されているのでそのまま返す
 */
export function formatJapaneseName(name: string | null | undefined): string {
  if (!name) return ''
  return name.trim()
}
