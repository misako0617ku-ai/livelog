import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60 // Vercel Hobby プランの上限

const BASE_URL = 'https://starto.jp'

// STARTOアーティスト一覧（DBのname → STARTOサイトのtag ID）
// IDはhttps://starto.jp/s/p/api/list/artist-list?で確認済み
const STARTO_ARTISTS: { name: string; tagId: number }[] = [
  // グループ
  { name: 'NEWS', tagId: 12 },
  { name: 'SUPER EIGHT', tagId: 13 },
  { name: 'Hey! Say! JUMP', tagId: 15 },
  { name: 'Kis-My-Ft2', tagId: 17 },
  { name: 'Timelesz', tagId: 24 },
  { name: 'A.B.C-Z', tagId: 26 },
  { name: 'ふぉ～ゆ～', tagId: 39 },
  { name: 'King & Prince', tagId: 41 },
  { name: 'SixTONES', tagId: 42 },
  { name: 'Snow Man', tagId: 43 },
  { name: 'なにわ男子', tagId: 56 },
  { name: '20th Century', tagId: 57 },
  { name: 'Travis Japan', tagId: 60 },
  { name: 'Aぇ! group', tagId: 157 },
  // ソロ（公式ソロアーティスト）
  { name: '内海光司', tagId: 3 },
  { name: '佐藤アツヒロ', tagId: 4 },
  { name: '内博貴', tagId: 27 },
  { name: '長谷川純', tagId: 32 },
  { name: '木村拓哉', tagId: 35 },
  { name: '林翔太', tagId: 44 },
  { name: '岡本圭人', tagId: 51 },
  { name: '室龍太', tagId: 52 },
  { name: '高田翔', tagId: 53 },
  { name: '今江大地', tagId: 61 },
  { name: '上田竜也', tagId: 77 },
  { name: '中丸雄一', tagId: 78 },
  { name: '中島裕翔', tagId: 81 },
  { name: '河合郁人', tagId: 100 },
  { name: '重岡大毅', tagId: 103 },
  { name: '桐山照史', tagId: 104 },
  { name: '中間淳太', tagId: 105 },
  { name: '神山智洋', tagId: 106 },
  { name: '藤井流星', tagId: 107 },
  { name: '濵田崇裕', tagId: 108 },
  { name: '小瀧望', tagId: 109 },
  { name: '相葉雅紀', tagId: 148 },
  { name: '櫻井翔', tagId: 152 },
  { name: '松本幸大', tagId: 153 },
  { name: '冨岡健翔', tagId: 154 },
  { name: '野澤祐樹', tagId: 155 },
  { name: '中島健人', tagId: 156 },
  { name: '堂本光一', tagId: 163 },
  { name: '横山裕', tagId: 167 },
  { name: '藤井直樹', tagId: 168 },
  { name: '草間リチャード敬太', tagId: 169 },
]

const CATEGORY_LABEL: Record<string, string> = {
  tv: 'TV',
  radio: 'ラジオ',
  magazine: '雑誌',
  web: 'WEB',
  concert: 'コンサート',
  stage: 'ステージ',
  event: 'イベント',
}

// メディアAPI（TV・ラジオ・雑誌・WEB）アイテム
type MediaItem = {
  code: string
  name: string
  catecode: string
  catename: string
  link: string
  comment1?: string
  comment2?: string
  comment3?: string
  year: string
  mont: string
  day: string
  time: string
}

// ライブAPI（コンサート・ステージ・イベント）アイテム
// "list"フィールドに個別日程が複数含まれる
type LiveItem = {
  code: string
  name: string
  catecode: string
  catename: string
  link: string
  comment3?: string
  list: string // 複数JSONオブジェクトが連結された文字列
}

// ライブの個別日程（listフィールドを展開したもの）
type LiveDate = {
  itemId: string
  date: string // YYYY-MM-DD
  pref: string
}

function buildStartDate(year: string, mont: string, day: string, time: string): string {
  const m = mont.padStart(2, '0')
  const d = day.padStart(2, '0')
  const t = time ? time.replace(/[^0-9:]/g, '').slice(0, 5) : '00:00'
  return `${year}-${m}-${d}T${t || '00:00'}:00+09:00`
}

// ライブのlistフィールド（複数JSONオブジェクト連結）を展開
function parseLiveDates(listStr: string): LiveDate[] {
  if (!listStr) return []
  const results: LiveDate[] = []
  const idMatches = listStr.matchAll(/"str_itemId"\s*:\s*"(\d+)"/g)
  const dateMatches = listStr.matchAll(/"str_itemDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/g)
  const prefMatches = listStr.matchAll(/"str_itemPlacePref"\s*:\s*"([^"]*)"/g)

  const ids = [...idMatches].map(m => m[1])
  const dates = [...dateMatches].map(m => m[1])
  const prefs = [...prefMatches].map(m => m[1])

  for (let i = 0; i < ids.length; i++) {
    results.push({
      itemId: ids[i],
      date: dates[i] ?? '',
      pref: prefs[i] ?? '',
    })
  }
  return results
}

function getTargetMonths(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = -1; i <= 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    months.push(`${y}${m}`)
  }
  return months
}

async function fetchMediaItems(tagId: number, month: string): Promise<MediaItem[]> {
  try {
    const url = `${BASE_URL}/s/p/api/list/media?dy=${month}&list[]=${tagId}&rw=3000`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LivelogBot/1.0)' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? []
  } catch {
    return []
  }
}

async function fetchLiveItems(tagId: number, month: string): Promise<LiveItem[]> {
  try {
    const url = `${BASE_URL}/s/p/api/list/live?dy=${month}&list[]=${tagId}&rw=3000`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LivelogBot/1.0)' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? []
  } catch {
    return []
  }
}

// 同時実行数を制限しながら並列処理するユーティリティ
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = []
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

export async function POST() {
  try {
    const supabase = createAdminClient()

    const { data: dbArtists } = await supabase.from('artists').select('id, name')
    if (!dbArtists) return NextResponse.json({ error: 'DB接続エラー' }, { status: 500 })
    const artistMap = new Map(dbArtists.map(a => [a.name, a.id]))

    const { data: existingEvents } = await supabase.from('events').select('url')
    const existingUrls = new Set(existingEvents?.map(e => e.url) ?? [])

    const months = getTargetMonths()

    // 全アーティスト×全月のAPIタスクを並列実行（同時10件）
    type NewEvent = {
      artist_id: string
      title: string
      start_date: string
      end_date: null
      url: string
      location: string | null
      description: string | null
      source: 'bandsintown'
    }
    const newEvents: NewEvent[] = []

    const tasks = STARTO_ARTISTS.flatMap(artist => {
      let artistId = artistMap.get(artist.name)
      return months.map(month => async () => {
        if (!artistId) return

        const [mediaItems, liveItems] = await Promise.all([
          fetchMediaItems(artist.tagId, month),
          fetchLiveItems(artist.tagId, month),
        ])

        for (const item of mediaItems) {
          const url = `${BASE_URL}/s/p/media/detail/${item.code}`
          if (existingUrls.has(url)) continue
          existingUrls.add(url)
          const categoryLabel = CATEGORY_LABEL[item.catecode] ?? item.catename
          const parts = [item.comment1, item.comment2, item.comment3].filter(Boolean)
          newEvents.push({
            artist_id: artistId!,
            title: `[${categoryLabel}] ${item.name.trim()}`,
            start_date: buildStartDate(item.year, item.mont, item.day, item.time),
            end_date: null,
            url,
            location: null,
            description: parts.length > 0 ? parts.join('\n') : null,
            source: 'bandsintown',
          })
        }

        for (const item of liveItems) {
          const liveDates = parseLiveDates(item.list ?? '')
          const categoryLabel = CATEGORY_LABEL[item.catecode] ?? item.catename
          for (const ld of liveDates) {
            if (!ld.date) continue
            const itemMonth = ld.date.slice(0, 7).replace('-', '')
            if (itemMonth !== month) continue
            const url = `${BASE_URL}/s/p/live/${item.code}/item/${ld.itemId}`
            if (existingUrls.has(url)) continue
            existingUrls.add(url)
            newEvents.push({
              artist_id: artistId!,
              title: `[${categoryLabel}] ${item.name.trim()}`,
              start_date: `${ld.date}T00:00:00+09:00`,
              end_date: null,
              url,
              location: ld.pref || null,
              description: item.comment3 || null,
              source: 'bandsintown',
            })
          }
        }
      })
    })

    await pLimit(tasks, 10) // 同時10件で並列実行

    // バッチinsert（100件ずつ）
    let inserted = 0
    const BATCH = 100
    for (let i = 0; i < newEvents.length; i += BATCH) {
      const batch = newEvents.slice(i, i + BATCH)
      const { error } = await supabase.from('events').insert(batch)
      if (!error) inserted += batch.length
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: existingEvents?.length ?? 0,
      months,
    })
  } catch (err) {
    console.error('Scrape error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  const now = new Date()
  const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const [media, live] = await Promise.all([
    fetchMediaItems(43, month), // Snow Man
    fetchLiveItems(43, month),
  ])

  const liveSample = live.slice(0, 2).map(item => ({
    code: item.code,
    name: item.name,
    catecode: item.catecode,
    dates: parseLiveDates(item.list ?? '').slice(0, 3),
  }))

  return NextResponse.json({
    artist: 'Snow Man',
    month,
    media: media.length,
    live: live.length,
    mediaSample: media.slice(0, 3),
    liveSample,
  })
}
