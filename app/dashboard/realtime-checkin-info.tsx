'use client'

import { useState, useEffect } from 'react'

interface RealtimeCheckinInfoProps {
  checkinAt: string
  memberType: 'regular' | 'dropin' | 'guest'
  planInfo?: {
    name: string
    startTime?: string
    endTime?: string
    availableDays?: string[]
  } | null
}

export function RealtimeCheckinInfo({
  checkinAt,
  memberType,
  planInfo,
}: RealtimeCheckinInfoProps) {
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [currentCharge, setCurrentCharge] = useState<number>(0)
  const [isOvertime, setIsOvertime] = useState(false)
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(0)

  useEffect(() => {
    const updateInfo = () => {
      const now = new Date()
      const checkinTime = new Date(checkinAt)
      const diffMs = now.getTime() - checkinTime.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMinutes / 60)

      setElapsedTime(diffMinutes)

      // ドロップイン会員の料金計算
      if (memberType === 'dropin') {
        // 1時間400円、最大2,000円
        const hours = Math.ceil(diffMinutes / 60)
        const charge = Math.min(hours * 400, 2000)
        setCurrentCharge(charge)
      }

      // 定期会員の時間外利用チェック
      if (memberType === 'regular' && planInfo) {
        const nowTime = now.getHours() * 60 + now.getMinutes() // 分単位
        const today = now.getDay() // 0=日曜, 1=月曜, ..., 6=土曜
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const todayName = dayNames[today]

        // プランの利用可能時間をチェック
        if (planInfo.startTime && planInfo.endTime) {
          // TIME型は "HH:MM:SS" 形式なので、最初の5文字を取得
          const startTimeStr = planInfo.startTime.substring(0, 5)
          const endTimeStr = planInfo.endTime.substring(0, 5)
          
          const [startHour, startMinute] = startTimeStr.split(':').map(Number)
          const [endHour, endMinute] = endTimeStr.split(':').map(Number)
          const startTimeMinutes = startHour * 60 + startMinute
          const endTimeMinutes = endHour * 60 + endMinute

          // 利用可能日かチェック
          const isAvailableDay = planInfo.availableDays?.includes(todayName) ?? true

          if (isAvailableDay) {
            // プラン時間内かチェック
            if (nowTime >= startTimeMinutes && nowTime <= endTimeMinutes) {
              // プラン時間内なので時間外利用ではない
              setIsOvertime(false)
              setOvertimeMinutes(0)
              setCurrentCharge(0)
            } else if (nowTime > endTimeMinutes) {
              // プラン時間を超過している
              const overtime = nowTime - endTimeMinutes
              // 10分の猶予を考慮
              const chargeableMinutes = Math.max(0, overtime - 10)
              if (chargeableMinutes >= 15) {
                setIsOvertime(true)
                setOvertimeMinutes(chargeableMinutes)
                // 30分200円、1時間400円、最大2,000円
                const hours = Math.ceil(chargeableMinutes / 60)
                const charge = Math.min(hours * 400, 2000)
                setCurrentCharge(charge)
              } else {
                // 猶予時間内なので課金なし
                setIsOvertime(false)
                setOvertimeMinutes(0)
                setCurrentCharge(0)
              }
            } else {
              // プラン時間前なので時間外利用ではない
              setIsOvertime(false)
              setOvertimeMinutes(0)
              setCurrentCharge(0)
            }
          } else {
            // 利用可能日ではない場合は時間外利用として扱う（簡易版）
            setIsOvertime(false)
            setOvertimeMinutes(0)
            setCurrentCharge(0)
          }
        }
      }
    }

    // 初回更新
    updateInfo()

    // 1秒ごとに更新
    const interval = setInterval(updateInfo, 1000)

    return () => clearInterval(interval)
  }, [checkinAt, memberType, planInfo])

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}時間${mins}分`
    }
    return `${mins}分`
  }

  return (
    <div className="mt-4 space-y-3">
      {/* 経過時間 */}
      <div className="rounded-md bg-room-main bg-opacity-10 p-3 border border-room-main">
        <p className="text-xs text-room-charcoal-light mb-1">経過時間</p>
        <p className="text-2xl font-bold text-room-main">
          {formatTime(elapsedTime)}
        </p>
      </div>

      {/* ドロップイン会員の料金表示 */}
      {memberType === 'dropin' && (
        <div className="rounded-md bg-room-wood bg-opacity-10 p-3 border border-room-wood">
          <p className="text-xs text-room-charcoal-light mb-1">現在の料金</p>
          <p className="text-xl font-bold text-room-wood">
            ¥{currentCharge.toLocaleString()}
            {currentCharge >= 2000 && (
              <span className="ml-2 text-sm font-normal text-room-charcoal-light">
                (最大料金到達)
              </span>
            )}
          </p>
          <p className="text-xs text-room-charcoal-light mt-1">
            1時間400円、最大2,000円
          </p>
        </div>
      )}

      {/* 定期会員の時間外利用警告 */}
      {memberType === 'regular' && isOvertime && (
        <div className="rounded-md bg-room-brass bg-opacity-20 p-3 border-2 border-room-brass">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-bold text-room-charcoal">時間外利用中</p>
          </div>
          <p className="text-xs text-room-charcoal-light mb-2">
            プラン利用時間を超過しています（10分の猶予を考慮）
          </p>
          {currentCharge > 0 && (
            <div>
              <p className="text-sm font-medium text-room-charcoal">
                追加料金: ¥{currentCharge.toLocaleString()}
              </p>
              <p className="text-xs text-room-charcoal-light mt-1">
                超過時間: {formatTime(overtimeMinutes)}（30分200円、最大2,000円）
              </p>
            </div>
          )}
        </div>
      )}

      {/* 定期会員のプラン残り時間（時間外利用でない場合） */}
      {memberType === 'regular' && planInfo && !isOvertime && planInfo.endTime && (
        <div className="rounded-md bg-room-base-dark p-3 border border-room-base-dark">
          <p className="text-xs text-room-charcoal-light mb-1">
            {planInfo.name}の利用可能時間
          </p>
          <p className="text-sm font-medium text-room-charcoal">
            {planInfo.startTime} - {planInfo.endTime}
          </p>
        </div>
      )}
    </div>
  )
}

