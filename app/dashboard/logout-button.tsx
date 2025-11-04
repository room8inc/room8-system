'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    
    // ログアウト処理
    await supabase.auth.signOut()
    
    // ログインページにリダイレクト
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-room-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-room-charcoal-light focus:outline-none focus:ring-2 focus:ring-room-charcoal focus:ring-offset-2"
    >
      ログアウト
    </button>
  )
}

