/**
 * Supabaseのエラーメッセージを日本語に変換する関数
 */
export function translateAuthError(error: any): string {
  if (!error) {
    return 'エラーが発生しました'
  }

  const errorMessage = error.message || error.toString()
  const errorCode = error.code || error.status

  // エラーメッセージとエラーコードの両方をチェック
  const message = errorMessage.toLowerCase()
  const code = errorCode?.toLowerCase() || ''

  // ユーザー登録関連のエラー
  if (
    message.includes('user already registered') ||
    message.includes('already registered') ||
    message.includes('user already exists') ||
    code === 'signup_disabled' ||
    code === 'user_already_exists'
  ) {
    return 'このメールアドレスは既に登録されています'
  }

  // メールアドレス関連のエラー
  if (
    message.includes('invalid email') ||
    message.includes('email is invalid') ||
    code === 'invalid_email'
  ) {
    return 'メールアドレスの形式が正しくありません'
  }

  // パスワード関連のエラー
  if (
    message.includes('password should be at least') ||
    message.includes('password must be at least') ||
    message.includes('password too short') ||
    code === 'password_too_short'
  ) {
    return 'パスワードは6文字以上で入力してください'
  }

  if (
    message.includes('password is too weak') ||
    message.includes('password too weak') ||
    code === 'password_too_weak'
  ) {
    return 'パスワードが弱すぎます。より複雑なパスワードを設定してください'
  }

  // ログイン関連のエラー
  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('email or password is incorrect') ||
    code === 'invalid_credentials' ||
    code === 'invalid_grant'
  ) {
    return 'メールアドレスまたはパスワードが正しくありません'
  }

  // メール確認関連のエラー
  if (
    message.includes('email not confirmed') ||
    message.includes('email is not confirmed') ||
    message.includes('email not verified') ||
    code === 'email_not_confirmed'
  ) {
    return 'メールアドレスの確認が完了していません。確認メールをご確認ください'
  }

  // レート制限関連のエラー
  if (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    code === 'rate_limit_exceeded'
  ) {
    return 'リクエストが多すぎます。しばらく時間をおいてから再度お試しください'
  }

  // セッション関連のエラー
  if (
    message.includes('session not found') ||
    message.includes('session expired') ||
    code === 'session_not_found' ||
    code === 'session_expired'
  ) {
    return 'セッションが無効です。再度ログインしてください'
  }

  // その他の一般的なエラー
  if (message.includes('network error') || message.includes('network')) {
    return 'ネットワークエラーが発生しました。インターネット接続を確認してください'
  }

  if (message.includes('timeout')) {
    return 'リクエストがタイムアウトしました。再度お試しください'
  }

  // 不明なエラーの場合は元のメッセージを返す（開発時のデバッグ用）
  // 本番環境では、より分かりやすいメッセージに変換
  return `アカウント作成に失敗しました: ${errorMessage}`
}

