'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, UserCheck, UserPlus, Loader2, Music } from 'lucide-react'
import type { Artist } from '@/types'
import Link from 'next/link'

export default function ArtistsPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [allArtists, setAllArtists] = useState<Artist[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newArtistName, setNewArtistName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const fetchArtists = useCallback(async () => {
    const { data } = await supabase
      .from('artists')
      .select('*')
      .order('name', { ascending: true })
    setAllArtists(data ?? [])
    setLoading(false)
  }, [])

  const fetchFollows = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('user_artists')
      .select('artist_id')
      .eq('user_id', userId)
    if (data) setFollowedIds(new Set(data.map(d => d.artist_id)))
  }, [userId])

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

  useEffect(() => {
    fetchFollows()
  }, [fetchFollows])

  const filteredArtists = query.trim()
    ? allArtists.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase())
      )
    : allArtists

  const handleFollow = async (artistId: string) => {
    if (!userId) return
    await supabase.from('user_artists').insert({ user_id: userId, artist_id: artistId })
    setFollowedIds(prev => new Set([...prev, artistId]))
  }

  const handleUnfollow = async (artistId: string) => {
    if (!userId) return
    await supabase.from('user_artists').delete().eq('user_id', userId).eq('artist_id', artistId)
    setFollowedIds(prev => {
      const next = new Set(prev)
      next.delete(artistId)
      return next
    })
  }

  const handleAddArtist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newArtistName.trim() || !userId) return
    setAdding(true)

    const existing = allArtists.find(
      a => a.name.toLowerCase() === newArtistName.trim().toLowerCase()
    )

    let artistId = existing?.id
    if (!artistId) {
      const { data } = await supabase
        .from('artists')
        .insert({ name: newArtistName.trim() })
        .select('id')
        .single()
      artistId = data?.id
      await fetchArtists()
    }

    if (artistId) {
      await supabase.from('user_artists').upsert({ user_id: userId, artist_id: artistId })
      setFollowedIds(prev => new Set([...prev, artistId!]))
      setNewArtistName('')
      setShowAddForm(false)
    }

    setAdding(false)
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Music className="w-16 h-16 text-pink-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">ログインしてアーティストをフォロー</h2>
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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">アーティストを探す</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl font-medium hover:bg-pink-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          アーティストを追加
        </button>
      </div>

      {showAddForm && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">新しいアーティストを登録</h3>
          <form onSubmit={handleAddArtist} className="flex gap-2">
            <input
              type="text"
              value={newArtistName}
              onChange={e => setNewArtistName(e.target.value)}
              placeholder="アーティスト名を入力"
              className="flex-1 px-3 py-2 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
            />
            <button
              type="submit"
              disabled={adding || !newArtistName.trim()}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : '追加'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          </form>
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="アーティスト名で絞り込み..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
        </div>
      ) : filteredArtists.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-2">{filteredArtists.length}組</p>
          {filteredArtists.map(artist => (
            <div
              key={artist.id}
              className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                  <Music className="w-5 h-5 text-pink-600" />
                </div>
                <span className="font-medium text-gray-900">{artist.name}</span>
              </div>

              {followedIds.has(artist.id) ? (
                <button
                  onClick={() => handleUnfollow(artist.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  フォロー中
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(artist.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  フォロー
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Music className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="mb-2">「{query}」に一致するアーティストが見つかりませんでした</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-pink-600 font-medium hover:underline text-sm"
          >
            アーティストを新規登録する
          </button>
        </div>
      )}
    </div>
  )
}
