'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, MapPin, Calendar, ExternalLink, Trash2, Edit, Music } from 'lucide-react'
import type { Event } from '@/types'
import EventModal from './EventModal'

type Props = {
  event: Event
  onClose: () => void
  onUpdated: () => void
}

export default function EventDetailModal({ event, onClose, onUpdated }: Props) {
  const supabase = createClient()
  const [showEditModal, setShowEditModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    await supabase.from('events').delete().eq('id', event.id)
    onUpdated()
    onClose()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (showEditModal) {
    return (
      <EventModal
        isOpen={true}
        onClose={() => setShowEditModal(false)}
        onSaved={onUpdated}
        event={event}
        artists={event.artist ? [event.artist] : []}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-600" />
            <span className="text-sm font-medium text-pink-600">
              {event.artist?.name ?? '不明なアーティスト'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{event.title}</h2>

          <div className="space-y-2.5 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
              <div>
                <div>{formatDate(event.start_date)}</div>
                {event.end_date && (
                  <div className="text-gray-400">〜 {formatDate(event.end_date)}</div>
                )}
              </div>
            </div>

            {event.venue && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                <div>
                  <div>{event.venue}</div>
                  {event.location && <div className="text-gray-400">{event.location}</div>}
                </div>
              </div>
            )}

            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-pink-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                チケット・詳細ページ
              </a>
            )}

            {event.description && (
              <div className="bg-gray-50 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">
                {event.description}
              </div>
            )}
          </div>
        </div>

        {event.source === 'manual' && (
          <div className="flex gap-2 p-6 pt-0">
            {confirmDelete ? (
              <>
                <span className="flex-1 text-sm text-gray-600 flex items-center">本当に削除しますか？</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  いいえ
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                >
                  削除
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  削除
                </button>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700"
                >
                  <Edit className="w-4 h-4" />
                  編集
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
