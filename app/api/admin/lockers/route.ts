import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/utils/admin'

export async function PATCH(request: NextRequest) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const supabase = await createClient()
  const body = await request.json()
  const { id, status, clearUser } = body

  if (!id) {
    return NextResponse.json({ error: 'ロッカーIDが必要です' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}

  if (status) {
    if (!['available', 'occupied', 'maintenance'].includes(status)) {
      return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
    }
    updateData.status = status
  }

  if (clearUser) {
    updateData.user_id = null
    updateData.status = 'available'
  }

  const { error } = await supabase
    .from('lockers')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function POST(request: NextRequest) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const supabase = await createClient()
  const body = await request.json()
  const { size } = body

  if (!size || !['large', 'small'].includes(size)) {
    return NextResponse.json({ error: 'サイズ（large/small）が必要です' }, { status: 400 })
  }

  // 最大のlocker_numberを取得して自動採番
  const prefix = size === 'large' ? 'L' : 'S'
  const { data: existing } = await supabase
    .from('lockers')
    .select('locker_number')
    .like('locker_number', `${prefix}-%`)
    .order('locker_number', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (existing && existing.length > 0) {
    const lastNum = parseInt(existing[0].locker_number.split('-')[1], 10)
    nextNumber = lastNum + 1
  }

  const lockerNumber = `${prefix}-${String(nextNumber).padStart(3, '0')}`

  const { data, error } = await supabase
    .from('lockers')
    .insert({ locker_number: lockerNumber, size, status: 'available' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, locker: data })
}

export async function DELETE(request: NextRequest) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ロッカーIDが必要です' }, { status: 400 })
  }

  // availableのもののみ削除可能
  const { data: locker } = await supabase
    .from('lockers')
    .select('status')
    .eq('id', id)
    .single()

  if (!locker) {
    return NextResponse.json({ error: 'ロッカーが見つかりません' }, { status: 404 })
  }

  if (locker.status !== 'available') {
    return NextResponse.json({ error: '利用可能なロッカーのみ削除できます' }, { status: 400 })
  }

  const { error } = await supabase
    .from('lockers')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
