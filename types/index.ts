export type Artist = {
  id: string
  name: string
  image_url: string | null
  bandsintown_id: string | null
  created_at: string
}

export type Event = {
  id: string
  artist_id: string
  title: string
  venue: string | null
  location: string | null
  start_date: string
  end_date: string | null
  url: string | null
  description: string | null
  source: 'manual' | 'bandsintown'
  created_at: string
  artist?: Artist
}

export type UserArtist = {
  id: string
  user_id: string
  artist_id: string
  created_at: string
  artist?: Artist
}

export type NotificationType = 'fc' | 'live' | 'all'

export type UserNotificationSettings = {
  id?: string
  user_id?: string
  notifications_enabled: boolean
  notify_types: NotificationType[]
  notify_days_before: number[]
  created_at?: string
}

export type FcMembership = {
  id: string
  user_id: string
  artist_id: string
  joined_year_month: string // YYYY-MM
  notifications_enabled: boolean
  created_at: string
  artist?: { id: string; name: string }
}
