import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'
import { invalidateKnowledgeCache } from '@/lib/line/knowledge-db'

export async function GET() {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('line_bot_knowledge')
    .select('*')
    .order('category')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const body = await request.json()
  const { category, title, content, sort_order, is_active } = body

  if (!category || !title || !content) {
    return NextResponse.json({ error: 'category, title, content は必須です' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('line_bot_knowledge')
    .insert({
      category,
      title,
      content,
      sort_order: sort_order ?? 0,
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await invalidateKnowledgeCache()

  return NextResponse.json(data, { status: 201 })
}
