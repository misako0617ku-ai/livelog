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
