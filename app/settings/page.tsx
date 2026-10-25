'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, BellOff, Save } from 'lucide-react'
import type { UserNotificationSettings, NotificationType } from '@/types'

const NOTIFY_TYPES: { value: NotificationType; label: string; desc: string }[] = [
  { value: 'fc', label: 'ファンクラブ更新期限', desc: 'FC更新開始日・締切日のリマインダー' },
  { value: 'live', label: 'コンサート・ステージ・イベント', desc: 'チケット申し込みが必要なイベント' },
  { value: 'all', label: '全イベント', desc: 'TV・ラジオ・雑誌・WEBなども含む全て' },
]

const NOTIFY_DAYS: { value: number; label: string }[] = [
  { value: 14, label: '2週間前' },
  { value: 7, label: '1週間前' },
  { value: 3, label: '3日前' },
  { value: 0, label: '当日' },
]

const DEFAULT_SETTINGS: UserNotificationSettings = {
  notifications_enabled: false,
  notify_types: ['fc'],
  notify_days_before: [14, 7],
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [settings, setSettings] = useState<UserNotificationSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth/login')
    })
    fetch('/api/notification-settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data)
        setLoading(false)
      })
  }, [])

  const toggleType = (type: NotificationType) => {
    setSettings(prev => ({
      ...prev,
      notify_types: prev.notify_types.includes(type)
        ? prev.notify_types.filter(t => t !== type)
        : [...prev.notify_types, type],
    }))
  }

  const toggleDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      notify_days_before: prev.notify_days_before.includes(day)
        ? prev.notify_days_before.filter(d => d !== day)
        : [...prev.notify_days_before, day],
    }))
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    const res = await fetch('/api/notification-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'エラーが発生しました')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 bg-pink-100 rounded-xl">
          <Bell className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">通知設定</h1>
          <p className="text-sm text-gray-500">メール通知のタイミングと内容を設定</p>
        </div>
      </div>

      {/* ON/OFF メイントグル */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">メール通知</p>
            <p className="text-sm text-gray-500">
              {settings.notifications_enabled ? '通知がONになっています' : '通知がOFFになっています'}
            </p>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, notifications_enabled: !prev.notifications_enabled }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              settings.notifications_enabled ? 'bg-pink-600' : 'bg-gray-200'
            }`}
            data-testid="notification-toggle"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {settings.notifications_enabled && (
        <>
          {/* 通知の種類 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">通知する内容</p>
            <div className="space-y-3">
              {NOTIFY_TYPES.map(({ value, label, desc }) => (
                <label key={value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.notify_types.includes(value)}
                    onChange={() => toggleType(value)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    data-testid={`type-${value}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-pink-700">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 通知タイミング */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">通知タイミング <span className="text-xs font-normal text-gray-500">（複数選択可）</span></p>
            <div className="grid grid-cols-2 gap-2">
              {NOTIFY_DAYS.map(({ value, label }) => {
                const selected = settings.notify_days_before.includes(value)
                return (
                  <button
                    key={value}
                    onClick={() => toggleDay(value)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-pink-50 border-pink-300 text-pink-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    data-testid={`day-${value}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-colors disabled:opacity-50"
        data-testid="save-button"
      >
        {saved ? (
          '✅ 保存しました'
        ) : (
          <>
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '設定を保存'}
          </>
        )}
      </button>

      <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
        <BellOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>通知メールは毎日朝4時（JST）に自動送信されます。</p>
      </div>
    </div>
  )
}
