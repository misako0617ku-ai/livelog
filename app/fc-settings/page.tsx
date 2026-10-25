'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Crown, Plus, Trash2, CalendarDays } from 'lucide-react'
import type { FcMembership, Artist } from '@/types'

function computeRenewalDates(joinedYearMonth: string) {
  const [yearStr, monthStr] = joinedYearMonth.split('-')
  const joinedYear = parseInt(yearStr)
  const joinedMonth = parseInt(monthStr) // 1-12

  const now = new Date()
  const results: { expiryDate: Date; renewalStart: Date }[] = []

  for (let offset = 1; offset <= 3; offset++) {
    const expiryYear = joinedYear + offset
    // Last day of the joined month in expiryYear
    const expiryDate = new Date(expiryYear, joinedMonth, 0)
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    if (expiryDate < sixMonthsAgo) continue

    const renewalStart = new Date(expiryDate)
    renewalStart.setDate(renewalStart.getDate() - 59)
    results.push({ expiryDate, renewalStart })
  }

  return results
}

function formatDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function FcSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [memberships, setMemberships] = useState<FcMembership[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newArtistId, setNewArtistId] = useState('')
  const [newYearMonth, setNewYearMonth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth/login')
    })
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/fc-memberships').then(r => r.json()),
      supabase.from('artists').select('id, name, image_url, bandsintown_id, created_at').order('name'),
    ]).then(([membershipsData, { data: artistsData }]) => {
      setMemberships(Array.isArray(membershipsData) ? membershipsData : [])
      setArtists(artistsData ?? [])
      setLoading(false)
    })
  }, [])

  const handleAdd = async () => {
    setError(null)
    if (!newArtistId || !newYearMonth) {
      setError('アーティストと入会年月を入力してください')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/fc-memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: newArtistId, joined_year_month: newYearMonth }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'エラーが発生しました')
    } else {
      setMemberships(prev => [...prev, data as FcMembership])
      setNewArtistId('')
      setNewYearMonth('')
      setAdding(false)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このFC情報を削除しますか？')) return
    const res = await fetch(`/api/fc-memberships/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMemberships(prev => prev.filter(m => m.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
      </div>
    )
  }

  const alreadyAddedIds = new Set(memberships.map(m => m.artist_id))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-xl">
          <Crown className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FC管理</h1>
          <p className="text-sm text-gray-500">ファンクラブの更新時期をカレンダーに自動表示</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">STARTOファンクラブ 更新ルール</p>
        <p>有効期限の<span className="font-bold">59日前</span>から更新手続きが可能。有効期限を過ぎると失効します。</p>
      </div>

      {memberships.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 mb-6">
          <Crown className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p>FC情報が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {memberships.map(m => {
            const renewals = computeRenewalDates(m.joined_year_month)
            const next = renewals[0]
            const [y, mo] = m.joined_year_month.split('-')
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">{m.artist?.name ?? '—'}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {y}年{mo}月入会
                      </span>
                    </div>
                    {next && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                          <CalendarDays className="w-3 h-3" />
                          <span>更新開始 {formatDate(next.renewalStart)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded-lg">
                          <CalendarDays className="w-3 h-3" />
                          <span>更新締切 {formatDate(next.expiryDate)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {adding ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">FC追加</p>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <select
              value={newArtistId}
              onChange={e => setNewArtistId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              <option value="">アーティストを選択</option>
              {artists
                .filter(a => !alreadyAddedIds.has(a.id))
                .map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
            <input
              type="month"
              value={newYearMonth}
              onChange={e => setNewYearMonth(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              placeholder="入会年月"
            />
          </div>
          {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={submitting}
              className="px-4 py-2 bg-pink-600 text-white text-sm rounded-xl font-medium hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {submitting ? '追加中...' : '追加'}
            </button>
            <button
              onClick={() => { setAdding(false); setError(null) }}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-medium hover:border-pink-400 hover:text-pink-600 transition-colors w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          FCを追加
        </button>
      )}
    </div>
  )
}
