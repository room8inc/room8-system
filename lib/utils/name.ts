/**
 * 名前を「姓 名」の順にフォーマットする
 * 入力が「名 姓」の順の場合、逆順にする
 * 入力が既に「姓 名」の順の場合はそのまま返す
 */
export function formatJapaneseName(name: string | null | undefined): string {
  if (!name) return ''

  // スペースで分割
  const parts = name.trim().split(/\s+/)

  // 1つの単語の場合、そのまま返す
  if (parts.length === 1) {
    return parts[0]
  }

  // 2つの単語の場合、逆順にする（名 姓 → 姓 名）
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`
  }

  // 3つ以上の単語の場合、最後の単語を姓として、それ以外を名とする
  // 例: "賢太 鶴田 太郎" → "鶴田 太郎 賢太"（最後を先頭に）
  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(0, -1).join(' ')
  return `${lastName} ${firstName}`
}

