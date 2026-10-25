'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import CalendarView from '@/components/CalendarView'
import EventModal from '@/components/EventModal'
import { Plus, Music, RefreshCw } from 'lucide-react'
import type { Event, Artist, FcMembership } from '@/types'
import type { FcCalendarEvent } from '@/components/CalendarView'
import Link from 'next/link'

function computeFcCalendarEvents(memberships: FcMembership[]): FcCalendarEvent[] {
  const fcEvents: FcCalendarEvent[] = []
  const now = new Date()
  const twoYearsAhead = new Date(now)
  twoYearsAhead.setFullYear(twoYearsAhead.getFullYear() + 2)
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  for (const m of memberships) {
    const [yearStr, monthStr] = m.joined_year_month.split('-')
    const joinedYear = parseInt(yearStr)
    const joinedMonth = parseInt(monthStr)
    const artistName = m.artist?.name ?? 'FC'

    for (let offset = 1; offset <= 3; offset++) {
      const expiryDate = new Date(joinedYear + offset, joinedMonth, 0)
      if (expiryDate < sixMonthsAgo || expiryDate > twoYearsAhead) continue

      const renewalStart = new Date(expiryDate)
      renewalStart.setDate(renewalStart.getDate() - 59)
      const toStr = (d: Date) => d.toISOString().slice(0, 10)

      fcEvents.push({
        id: `fc-start-${m.id}-${offset}`,
        title: `🔔 FC更新開始: ${artistName}`,
        start: toStr(renewalStart),
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        allDay: true,
        extendedProps: {
          isFcEvent: true,
          description: `${artistName} FCの更新手続きが開始されました。\n更新締切: ${toStr(expiryDate)}まで`,
        },
      })
      fcEvents.push({
        id: `fc-end-${m.id}-${offset}`,
        title: `⚠️ FC更新締切: ${artistName}`,
        start: toStr(expiryDate),
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        allDay: true,
        extendedProps: {
          isFcEvent: true,
          description: `${artistName} FCの更新締切日です。\nこの日までに更新しないと会員資格が失効します。`,
        },
      })
    }
  }
  return fcEvents
}

export default function CalendarPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [followedArtists, setFollowedArtists] = useState<Artist[]>([])
  const [fcMemberships, setFcMemberships] = useState<FcMembership[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    let artistIds: string[] = []

    if (userId) {
      const { data: userArtists } = await supabase
        .from('user_artists')
        .select('artist_id, artists(*)')
        .eq('user_id', userId)

      if (userArtists) {
        artistIds = userArtists.map(ua => ua.artist_id)
        setFollowedArtists(userArtists.map(ua => ua.artists as unknown as Artist).filter(Boolean))
      }
    }

    if (artistIds.length > 0) {
      const { data } = await supabase
        .from('events')
        .select('*, artist:artists(*)')
        .in('artist_id', artistIds)
        .order('start_date', { ascending: true })

      setEvents((data as unknown as Event[]) ?? [])
    } else {
      setEvents([])
    }

    // FC管理情報を取得
    const fcRes = await fetch('/api/fc-memberships')
    if (fcRes.ok) {
      const fcData = await fcRes.json()
      setFcMemberships(Array.isArray(fcData) ? fcData : [])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/scrape/starto', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncResult(`✅ ${data.inserted}件追加（${data.skipped}件はスキップ）`)
        fetchData()
      } else {
        setSyncResult(`❌ エラー: ${data.error}`)
      }
    } catch {
      setSyncResult('❌ 通信エラーが発生しました')
    }
    setSyncing(false)
  }

  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    setShowAddModal(true)
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Music className="w-16 h-16 text-pink-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">ログインしてカレンダーを使う</h2>
        <p className="text-gray-500 mb-6">フォロー中のアーティストのイベントが表示されます</p>
        <Link
          href="/auth/login"
          className="px-6 py-2.5 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-colors"
        >
          ログイン
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">マイカレンダー</h1>
          {followedArtists.length > 0 && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {followedArtists.map(a => (
                <span key={a.id} className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                  {a.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 border border-pink-300 text-pink-600 rounded-xl font-medium hover:bg-pink-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同期中...' : 'STARTOから取得'}
          </button>
          {followedArtists.length > 0 && (
            <button
              onClick={() => { setSelectedDate(undefined); setShowAddModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl font-medium hover:bg-pink-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              イベント追加
            </button>
          )}
        </div>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${syncResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {syncResult}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
        </div>
      ) : followedArtists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Music className="w-16 h-16 text-pink-200 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">アーティストをフォローしよう</h2>
          <p className="text-gray-500 mb-6">フォローしたアーティストのイベントがカレンダーに表示されます</p>
          <Link
            href="/artists"
            className="px-6 py-2.5 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-colors"
          >
            アーティストを探す
          </Link>
        </div>
      ) : (
        <CalendarView
          events={events}
          fcEvents={computeFcCalendarEvents(fcMemberships)}
          onDateClick={handleDateClick}
          onEventUpdated={fetchData}
        />
      )}

      <EventModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={fetchData}
        initialDate={selectedDate}
        artists={followedArtists}
      />
    </div>
  )
}
