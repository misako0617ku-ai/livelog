import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

// ─── 型定義 ────────────────────────────────────────────────
type FcSection = {
  type: 'fc'
  artistName: string
  daysLeft: number
  deadlineStr: string
  renewalStartStr: string
  fcMembershipId: string
  deadlineDateStr: string
}

type EventItem = {
  id: string
  title: string
  date: string
  url: string | null
  artistName: string
}

type EventSection = {
  type: 'events'
  daysLeft: number
  userId: string
  items: EventItem[]
}

type Section = FcSection | EventSection

// ─── ユーティリティ ──────────────────────────────────────────
function computeNextRenewalDeadline(joinedYearMonth: string): Date | null {
  const [yearStr, monthStr] = joinedYearMonth.split('-')
  const joinedYear = parseInt(yearStr)
  const joinedMonth = parseInt(monthStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let offset = 1; offset <= 5; offset++) {
    const deadline = new Date(joinedYear + offset, joinedMonth, 0)
    if (deadline >= today) return deadline
  }
  return null
}

function formatDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function todayJST(): Date {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  jst.setUTCHours(0, 0, 0, 0)
  return jst
}

function artistName(raw: unknown): string {
  if (!raw) return ''
  if (Array.isArray(raw)) return (raw[0] as { name: string })?.name ?? ''
  return (raw as { name: string }).name ?? ''
}

// ─── メール生成 ──────────────────────────────────────────────
function buildSubject(sections: Section[]): string {
  const parts: string[] = []
  const fcCount = sections.filter(s => s.type === 'fc').length
  const eventCount = sections.filter(s => s.type === 'events').reduce((n, s) => n + (s as EventSection).items.length, 0)
  if (fcCount > 0) parts.push(`FC更新${fcCount}件`)
  if (eventCount > 0) parts.push(`イベント${eventCount}件`)
  return `【ライブログ】${parts.join('・')}のお知らせ`
}

function buildHtml(sections: Section[], siteUrl: string): string {
  const blocks = sections.map(s => {
    if (s.type === 'fc') {
      return `
<div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
  <p style="margin:0 0 6px;font-weight:bold;color:#92400e;">🔔 FC更新リマインダー（あと${s.daysLeft === 0 ? '本日' : `${s.daysLeft}日`}）</p>
  <p style="margin:0 0 4px;font-size:15px;color:#1f2937;"><strong>${s.artistName}</strong> ファンクラブ</p>
  <p style="margin:0;font-size:13px;color:#6b7280;">更新開始: ${s.renewalStartStr}　締切: <strong style="color:#dc2626;">${s.deadlineStr}</strong></p>
</div>`
    } else {
      const eventRows = s.items.map(e => {
        const name = e.url
          ? `<a href="${e.url}" style="color:#db2777;text-decoration:none;">${e.title}</a>`
          : e.title
        return `<li style="margin-bottom:6px;">${name} <span style="color:#9ca3af;font-size:12px;">${e.artistName}</span></li>`
      }).join('')
      return `
<div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
  <p style="margin:0 0 8px;font-weight:bold;color:#065f46;">📅 ${s.daysLeft === 0 ? '本日' : `${s.daysLeft}日後`}のイベント</p>
  <ul style="margin:0;padding-left:16px;font-size:14px;color:#1f2937;">${eventRows}</ul>
</div>`
    }
  }).join('')

  return `
<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
  <div style="background:#fdf2f8;border-radius:12px;padding:18px 24px;margin-bottom:20px;">
    <h2 style="color:#db2777;margin:0 0 4px;font-size:20px;">🎵 ライブログ</h2>
    <p style="color:#6b7280;margin:0;font-size:13px;">あなたへのお知らせをまとめてお届けします</p>
  </div>
  ${blocks}
  <div style="margin-top:20px;text-align:center;">
    <a href="${siteUrl}" style="display:inline-block;background:#db2777;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;">
      ライブログを開く
    </a>
  </div>
  <p style="margin-top:24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
    <a href="${siteUrl}/settings" style="color:#db2777;">通知設定を変更</a>
  </p>
</div>`
}

// ─── メインハンドラ ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://livelog-ten.vercel.app'
  const today = todayJST()

  // 1. 通知有効なユーザー設定を取得
  const { data: allSettings } = await supabase
    .from('user_notification_settings')
    .select('*')
    .eq('notifications_enabled', true)

  if (!allSettings?.length) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  // 2. 全ユーザーのメールをまとめて取得
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(users.map(u => [u.id, u.email ?? '']))

  let sent = 0

  for (const setting of allSettings) {
    const email = emailMap.get(setting.user_id)
    if (!email) continue

    const sections: Section[] = []
    const days: number[] = setting.notify_days_before

    // ── FC通知 ──────────────────────────────────────────────
    if ((setting.notify_types as string[]).includes('fc')) {
      const { data: memberships } = await supabase
        .from('fan_club_memberships')
        .select('id, joined_year_month, artist:artists(name)')
        .eq('user_id', setting.user_id)
        .eq('notifications_enabled', true)

      for (const m of memberships ?? []) {
        const deadline = computeNextRenewalDeadline(m.joined_year_month)
        if (!deadline) continue
        const aName = artistName(m.artist)

        for (const d of days) {
          const notifyDate = new Date(deadline)
          notifyDate.setDate(notifyDate.getDate() - d)
          notifyDate.setHours(0, 0, 0, 0)
          if (notifyDate.getTime() !== today.getTime()) continue

          const deadlineDateStr = deadline.toISOString().slice(0, 10)
          const { data: alreadySent } = await supabase
            .from('notification_sent_logs')
            .select('id')
            .eq('fc_membership_id', m.id)
            .eq('renewal_deadline', deadlineDateStr)
            .eq('days_before', d)
            .maybeSingle()

          if (alreadySent) continue

          const renewalStart = new Date(deadline)
          renewalStart.setDate(renewalStart.getDate() - 59)
          sections.push({
            type: 'fc',
            artistName: aName,
            daysLeft: d,
            deadlineStr: formatDate(deadline),
            renewalStartStr: formatDate(renewalStart),
            fcMembershipId: m.id,
            deadlineDateStr,
          })
        }
      }
    }

    // ── イベント通知 ────────────────────────────────────────
    const wantsAll = (setting.notify_types as string[]).includes('all')
    const wantsLive = (setting.notify_types as string[]).includes('live')

    if (wantsAll || wantsLive) {
      const { data: userArtists } = await supabase
        .from('user_artists')
        .select('artist_id')
        .eq('user_id', setting.user_id)
      const artistIds = (userArtists ?? []).map((ua: { artist_id: string }) => ua.artist_id)

      if (artistIds.length > 0) {
        for (const d of days) {
          const targetDate = new Date(today)
          targetDate.setDate(targetDate.getDate() + d)
          const dateStr = targetDate.toISOString().slice(0, 10)

          let query = supabase
            .from('events')
            .select('id, title, start_date, url, artist:artists(name)')
            .in('artist_id', artistIds)
            .gte('start_date', `${dateStr}T00:00:00+09:00`)
            .lte('start_date', `${dateStr}T23:59:59+09:00`)

          if (!wantsAll && wantsLive) {
            query = query.or(
              'title.ilike.[コンサート]%,title.ilike.[ステージ]%,title.ilike.[イベント]%'
            )
          }

          const { data: events } = await query
          if (!events?.length) continue

          // 送信済みを除外
          const { data: alreadySent } = await supabase
            .from('event_notification_sent_logs')
            .select('event_id')
            .eq('user_id', setting.user_id)
            .eq('days_before', d)
            .in('event_id', events.map((e: { id: string }) => e.id))

          const sentIds = new Set((alreadySent ?? []).map((s: { event_id: string }) => s.event_id))
          const newEvents = events.filter((e: { id: string }) => !sentIds.has(e.id))

          if (newEvents.length > 0) {
            sections.push({
              type: 'events',
              daysLeft: d,
              userId: setting.user_id,
              items: newEvents.map((e: { id: string; title: string; start_date: string; url: string | null; artist: unknown }) => ({
                id: e.id,
                title: e.title,
                date: e.start_date,
                url: e.url,
                artistName: artistName(e.artist),
              })),
            })
          }
        }
      }
    }

    if (sections.length === 0) continue

    // 3. メール送信
    const { error: sendError } = await resend.emails.send({
      from: 'ライブログ <onboarding@resend.dev>',
      to: email,
      subject: buildSubject(sections),
      html: buildHtml(sections, siteUrl),
    })

    if (sendError) continue

    // 4. 送信ログを記録
    for (const s of sections) {
      if (s.type === 'fc') {
        await supabase.from('notification_sent_logs').insert({
          fc_membership_id: s.fcMembershipId,
          renewal_deadline: s.deadlineDateStr,
          days_before: s.daysLeft,
        })
      } else {
        if (s.items.length > 0) {
          await supabase.from('event_notification_sent_logs').insert(
            s.items.map(e => ({
              user_id: s.userId,
              event_id: e.id,
              days_before: s.daysLeft,
            }))
          )
        }
      }
    }
    sent++
  }

  return NextResponse.json({ success: true, sent, checkedAt: new Date().toISOString() })
}
