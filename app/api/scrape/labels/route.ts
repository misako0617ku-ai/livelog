import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 300

// ---- アーティスト設定 ----

// Universal Music Japan
const UMJ_ARTISTS = [
  { slug: 'kaito',           artistName: '髙橋海人' },
  { slug: 'king-and-prince', artistName: 'King & Prince' },
  { slug: 'travisjapan',     artistName: 'Travis Japan' },
  { slug: 'aegroup',         artistName: 'Aぇ! group' },
  { slug: 'timelesz',        artistName: 'Timelesz' },
  { slug: 'key-to-lit',      artistName: 'KEY TO LIT' },
]

// MENT RECORDING (Snow Man / Kis-My-Ft2 / 20th Century)
const MENT_ARTISTS = [
  { slug: 'snowman',      artistName: 'Snow Man' },
  { slug: 'kismyft2',     artistName: 'Kis-My-Ft2' },
  { slug: '20thcentury',  artistName: '20th Century' },
]

// SixTONES (Sony Music)
const SIXTONES_BASE = 'https://www.sixtones.jp'

// INFINITY RECORDS (SUPER EIGHT)
const INFINITY_BASE = 'https://infinity-r.jp'
const INFINITY_NEWS_URL = `${INFINITY_BASE}/s/ifr/news/list`

// PONY CANYON (A.B.C-Z)
const ABCZ_BASE = 'https://abcz.ponycanyon.co.jp'
const ABCZ_NEWS_URL = `${ABCZ_BASE}/news/index.html`

// ---- キーワードフィルタ ----

const EVENT_KEYWORDS = [
  'イベント開催', '発売記念イベント', 'リリース記念イベント',
  'ライブツアー', 'コンサート', 'LIVE TOUR', 'ファンクラブ',
  '全国.*都市', '全国.*会場', '招待', '会場販売', '衣装展',
  '特別展', 'ファンミ', 'お渡し会',
]

const NOISE_KEYWORDS = [
  'Spotify', 'Apple Music', 'iTunes', 'ダウンロードキャンペーン',
  'フォローキャンペーン', 'プレオーダー', 'Pre-save', 'Pre-add',
  'OA解禁', 'MV公開', 'ジャケット写真', 'サブスク配信', 'Canvas',
  '先行配信', 'プレイリスト', 'LINE MUSIC',
]

// ---- ユーティリティ ----

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LivelogBot/1.0)' },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&#038;/g, '&').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

function stripTagsToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\r/g, '')
    .trim()
}

function isEventArticle(title: string): boolean {
  if (NOISE_KEYWORDS.some(kw => new RegExp(kw).test(title))) return false
  return EVENT_KEYWORDS.some(kw => new RegExp(kw).test(title))
}

// ---- パーサー ----

// UMJ: href="https://www.universal-music.co.jp/{slug}/news/DATE/" + <span class="tags__date"> + <p>TITLE</p>
function parseUmjList(html: string, slug: string): { url: string; title: string; dateStr: string }[] {
  const results: { url: string; title: string; dateStr: string }[] = []
  const seen = new Set<string>()
  const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pat = new RegExp(
    `href="(https://www\\.universal-music\\.co\\.jp/${esc}/news/[^"]+)"` +
    `[\\s\\S]*?<span[^>]*class="tags__date"[^>]*>(\\d{4}\\.\\d{2}\\.\\d{2})</span>` +
    `[\\s\\S]*?<p>([^<]{5,120})</p>`, 'g'
  )
  let m: RegExpExecArray | null
  while ((m = pat.exec(html)) !== null) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    results.push({ url: m[1], title: decodeEntities(m[3]), dateStr: m[2] })
  }
  return results
}

// MENT: href="/snowman/news/detail.php?id=..." + datetime="YYYY-MM-DD" + <p class="infoList__text">
function parseMentList(html: string, base: string, slug: string): { url: string; title: string; dateStr: string }[] {
  const results: { url: string; title: string; dateStr: string }[] = []
  const seen = new Set<string>()
  const pat = new RegExp(
    `href="(/${slug}/news/detail\\.php\\?id=\\d+)"[\\s\\S]*?` +
    `datetime="(\\d{4}-\\d{2}-\\d{2})"[\\s\\S]*?` +
    `<p class="infoList__text">([^<]{5,120})</p>`, 'g'
  )
  let m: RegExpExecArray | null
  while ((m = pat.exec(html)) !== null) {
    const url = `${base}${m[1]}`
    if (seen.has(url)) continue
    seen.add(url)
    const [y, mo, d] = m[2].split('-')
    results.push({ url, title: decodeEntities(m[3]), dateStr: `${y}.${mo}.${d}` })
  }
  return results
}

// INFINITY RECORDS: href="/s/ifr/news/detail/NNN?ima=..." + <div class="p-news__card__date"><p>YYYY.MM.DD</p> + <div class="p-news__card__title"><p>TITLE</p>
function parseInfinityList(html: string): { url: string; title: string; dateStr: string }[] {
  const results: { url: string; title: string; dateStr: string }[] = []
  const seen = new Set<string>()
  const pat = /href="(\/s\/ifr\/news\/detail\/\d+[^"]*)"[\s\S]*?<div class="p-news__card__date">[\s\S]*?<p>([\d.]+)<\/p>[\s\S]*?<div class="p-news__card__title">[\s\S]*?<p>([^<]{5,120})<\/p>/g
  let m: RegExpExecArray | null
  while ((m = pat.exec(html)) !== null) {
    const url = `${INFINITY_BASE}${m[1]}`
    if (seen.has(url)) continue
    seen.add(url)
    const parts = m[2].split('.')
    const dateStr = `${parts[0]}.${parts[1].padStart(2, '0')}.${parts[2].padStart(2, '0')}`
    results.push({ url, title: decodeEntities(m[3]), dateStr })
  }
  return results
}

// PONY CANYON A.B.C-Z: <div class="date">YYYY-MM-DD</div> + <p><a href="URL">TITLE</a></p>
function parseAbczList(html: string): { url: string; title: string; dateStr: string }[] {
  const results: { url: string; title: string; dateStr: string }[] = []
  const seen = new Set<string>()
  const pat = /<div class="date">(\d{4}-\d{2}-\d{2})<\/div>[\s\S]*?<p><a href="([^"]+)"[^>]*>([^<]{5,120})<\/a><\/p>/g
  let m: RegExpExecArray | null
  while ((m = pat.exec(html)) !== null) {
    let href = m[2]
    let url: string
    if (href.startsWith('http')) {
      url = href
    } else if (href.startsWith('../')) {
      url = `${ABCZ_BASE}/${href.replace(/^\.\.\//, '')}`
    } else {
      url = `${ABCZ_BASE}/news/${href}`
    }
    if (seen.has(url)) continue
    seen.add(url)
    const [y, mo, d] = m[1].split('-')
    results.push({ url, title: decodeEntities(m[3]), dateStr: `${y}.${mo}.${d}` })
  }
  return results
}

// SixTONES: href="/news/NNN" + <p class="p-news-list-item__date"> + <h3 class="p-news-list-item__title">
function parseSixTonesList(html: string): { url: string; title: string; dateStr: string }[] {
  const results: { url: string; title: string; dateStr: string }[] = []
  const seen = new Set<string>()
  const pat = /href="(\/news\/(\d+))"[\s\S]*?<p class="p-news-list-item__date">([\d.]+)<\/p>[\s\S]*?<h3[^>]*>([^<]{5,120})<\/h3>/g
  let m: RegExpExecArray | null
  while ((m = pat.exec(html)) !== null) {
    const url = `${SIXTONES_BASE}${m[1]}`
    if (seen.has(url)) continue
    seen.add(url)
    // 日付: "2026.9.16" → "2026.09.16"
    const parts = m[3].split('.')
    const dateStr = `${parts[0]}.${parts[1].padStart(2, '0')}.${parts[2].padStart(2, '0')}`
    results.push({ url, title: decodeEntities(m[4]), dateStr })
  }
  return results
}

// 記事本文からイベント日程を抽出: "11月13日（金）：福岡県" のパターン
function parseJapaneseDates(text: string, articleDateStr: string): { date: string; location: string | null }[] {
  const results: { date: string; location: string | null }[] = []
  const seen = new Set<string>()
  const [articleYear, articleMonth] = articleDateStr.split('.').map(Number)

  const pat = /(\d{1,2})月(\d{1,2})日[（(][月火水木金土日][）)][：: ]*([^\n。]{0,60})?/g
  let m: RegExpExecArray | null
  while ((m = pat.exec(text)) !== null) {
    const month = parseInt(m[1])
    const day = parseInt(m[2])
    let loc = m[3]?.trim() || null
    if (loc) {
      loc = loc.split(/[\/／]/)[0]?.trim() || loc
      if (loc.length > 15 || /https?|www/.test(loc)) loc = null
    }
    let year = articleYear
    if (month < articleMonth - 6) year++
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+09:00`
    if (seen.has(dateStr)) continue
    seen.add(dateStr)
    results.push({ date: dateStr, location: loc })
  }
  return results
}

// ---- メイン処理 ----

type LabelEvent = {
  artist_id: string
  title: string
  start_date: string
  end_date: null
  url: string
  location: string | null
  description: string | null
  performers: string | null
  source: 'label'
}

async function processArticles(
  articles: { url: string; title: string; dateStr: string }[],
  artistId: string,
  eventMap: Map<string, LabelEvent>,
) {
  for (const article of articles) {
    if (!isEventArticle(article.title)) continue

    const articleHtml = await fetchHtml(article.url)
    if (!articleHtml) continue

    const text = stripTagsToText(articleHtml)
    const eventDates = parseJapaneseDates(text, article.dateStr)

    if (eventDates.length > 0) {
      for (const { date, location } of eventDates) {
        const url = `${article.url}#${date.slice(0, 10)}`
        if (eventMap.has(url)) continue
        eventMap.set(url, {
          artist_id: artistId,
          title: `[イベント] ${article.title}`,
          start_date: date,
          end_date: null,
          url,
          location,
          description: article.url,
          performers: null,
          source: 'label',
        })
      }
    } else {
      if (eventMap.has(article.url)) continue
      const [y, mo, d] = article.dateStr.split('.')
      eventMap.set(article.url, {
        artist_id: artistId,
        title: `[イベント] ${article.title}`,
        start_date: `${y}-${mo}-${d}T00:00:00+09:00`,
        end_date: null,
        url: article.url,
        location: null,
        description: null,
        performers: null,
        source: 'label',
      })
    }

    await new Promise(r => setTimeout(r, 400))
  }
}

export async function POST() {
  try {
    const supabase = createAdminClient()
    const { data: dbArtists } = await supabase.from('artists').select('id, name')
    const artistMap = new Map(dbArtists?.map(a => [a.name, a.id]) ?? [])
    const eventMap = new Map<string, LabelEvent>()

    // Universal Music Japan
    for (const { slug, artistName } of UMJ_ARTISTS) {
      const artistId = artistMap.get(artistName)
      if (!artistId) continue
      const html = await fetchHtml(`https://www.universal-music.co.jp/${slug}/news/`)
      if (!html) continue
      const articles = parseUmjList(html, slug)
      await processArticles(articles, artistId, eventMap)
      await new Promise(r => setTimeout(r, 500))
    }

    // MENT RECORDING
    for (const { slug, artistName } of MENT_ARTISTS) {
      const artistId = artistMap.get(artistName)
      if (!artistId) continue
      const base = `https://mentrecording.jp`
      const html = await fetchHtml(`${base}/${slug}/news/`)
      if (!html) continue
      const articles = parseMentList(html, base, slug)
      await processArticles(articles, artistId, eventMap)
      await new Promise(r => setTimeout(r, 500))
    }

    // SixTONES
    {
      const artistId = artistMap.get('SixTONES')
      if (artistId) {
        const html = await fetchHtml(`${SIXTONES_BASE}/news/`)
        if (html) {
          const articles = parseSixTonesList(html)
          await processArticles(articles, artistId, eventMap)
        }
      }
    }

    // INFINITY RECORDS (SUPER EIGHT)
    {
      const artistId = artistMap.get('SUPER EIGHT')
      if (artistId) {
        const html = await fetchHtml(INFINITY_NEWS_URL)
        if (html) {
          const articles = parseInfinityList(html)
          await processArticles(articles, artistId, eventMap)
        }
      }
    }

    // PONY CANYON (A.B.C-Z)
    {
      const artistId = artistMap.get('A.B.C-Z')
      if (artistId) {
        const html = await fetchHtml(ABCZ_NEWS_URL)
        if (html) {
          const articles = parseAbczList(html)
          await processArticles(articles, artistId, eventMap)
        }
      }
    }

    // DB保存（URL重複チェック → 新規のみINSERT）
    const allUrls = [...eventMap.keys()]
    const existingUrls = new Set<string>()
    const CHUNK = 500
    for (let i = 0; i < allUrls.length; i += CHUNK) {
      const chunk = allUrls.slice(i, i + CHUNK)
      const { data } = await supabase.from('events').select('url').in('url', chunk)
      for (const row of data ?? []) existingUrls.add(row.url)
    }

    const toInsert = allUrls
      .filter(url => !existingUrls.has(url))
      .map(url => eventMap.get(url)!)

    let inserted = 0
    const BATCH = 100
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH)
      const { error } = await supabase.from('events').insert(batch)
      if (!error) inserted += batch.length
      else console.error('[labels] insert error:', error.message)
    }

    return NextResponse.json({ success: true, inserted, scanned: allUrls.length })
  } catch (err) {
    console.error('[labels] scrape error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// テスト用: 各レーベルサイトで検出されるイベント記事一覧
export async function GET() {
  const result: Record<string, { title: string; dateStr: string; isEvent: boolean }[]> = {}

  for (const { slug } of UMJ_ARTISTS) {
    const html = await fetchHtml(`https://www.universal-music.co.jp/${slug}/news/`)
    const articles = html ? parseUmjList(html, slug) : []
    result[`umj/${slug}`] = articles.map(a => ({ ...a, isEvent: isEventArticle(a.title) }))
  }

  for (const { slug } of MENT_ARTISTS) {
    const base = 'https://mentrecording.jp'
    const html = await fetchHtml(`${base}/${slug}/news/`)
    const articles = html ? parseMentList(html, base, slug) : []
    result[`ment/${slug}`] = articles.map(a => ({ ...a, isEvent: isEventArticle(a.title) }))
  }

  {
    const html = await fetchHtml(`${SIXTONES_BASE}/news/`)
    const articles = html ? parseSixTonesList(html) : []
    result['sixtones'] = articles.map(a => ({ ...a, isEvent: isEventArticle(a.title) }))
  }

  {
    const html = await fetchHtml(INFINITY_NEWS_URL)
    const articles = html ? parseInfinityList(html) : []
    result['infinity/super-eight'] = articles.map(a => ({ ...a, isEvent: isEventArticle(a.title) }))
  }

  {
    const html = await fetchHtml(ABCZ_NEWS_URL)
    const articles = html ? parseAbczList(html) : []
    result['ponycanyon/abc-z'] = articles.map(a => ({ ...a, isEvent: isEventArticle(a.title) }))
  }

  return NextResponse.json(result)
}
