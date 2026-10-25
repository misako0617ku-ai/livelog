import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const NOTIFY_DAYS = [14, 7, 1]

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

function buildEmail(artistName: string, daysLeft: number, deadline: Date, siteUrl: string) {
  const renewalStart = new Date(deadline)
  renewalStart.setDate(renewalStart.getDate() - 59)

  return {
    subject: `【ライブログ】${artistName} FC更新まであと${daysLeft}日`,
    html: `
<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
  <div style="background:#fdf2f8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
    <h2 style="color:#db2777;margin:0 0 4px;font-size:20px;">🎵 FC更新リマインダー</h2>
    <p style="color:#6b7280;margin:0;font-size:14px;">ライブログからのお知らせ</p>
  </div>

  <p style="font-size:16px;line-height:1.6;">
    <strong>${artistName}</strong> のファンクラブ更新まで<br>
    <span style="color:#dc2626;font-size:28px;font-weight:bold;">あと${daysLeft}日</span> です。
  </p>

  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:20px 0;">
    <p style="margin:0 0 10px;color:#6b7280;font-size:13px;font-weight:600;">📅 更新スケジュール</p>
    <p style="margin:0 0 6px;">🔔 更新開始日: <strong>${formatDate(renewalStart)}</strong></p>
    <p style="margin:0;color:#dc2626;">⚠️ 更新締切日: <strong>${formatDate(deadline)}</strong></p>
  </div>

  <a href="${siteUrl}/fc-settings"
     style="display:inline-block;background:#db2777;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;">
    FC管理ページを確認する →
  </a>

  <p style="margin-top:32px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
    このメールはライブログの通知設定に基づいて送信されました。<br>
    通知を停止するには <a href="${siteUrl}/fc-settings" style="color:#db2777;">FC管理ページ</a> からオフにしてください。
  </p>
</div>`,
  }
}

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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: memberships, error: mbError } = await supabase
    .from('fan_club_memberships')
    .select('id, user_id, joined_year_month, artist:artists(name)')
    .eq('notifications_enabled', true)

  if (mbError) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // 全ユーザーのメールアドレスをまとめて取得
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(users.map(u => [u.id, u.email ?? '']))

  let sent = 0
  let skipped = 0

  for (const m of memberships ?? []) {
    const deadline = computeNextRenewalDeadline(m.joined_year_month)
    if (!deadline) continue

    const email = emailMap.get(m.user_id)
    if (!email) continue

    const artistRaw = m.artist as { name: string } | { name: string }[] | null
    const artistName = (Array.isArray(artistRaw) ? artistRaw[0]?.name : artistRaw?.name) ?? 'FC'

    for (const days of NOTIFY_DAYS) {
      const notifyDate = new Date(deadline)
      notifyDate.setDate(notifyDate.getDate() - days)
      notifyDate.setHours(0, 0, 0, 0)

      if (notifyDate.getTime() !== today.getTime()) continue

      const deadlineDateStr = deadline.toISOString().slice(0, 10)

      // 送信済みならスキップ
      const { data: existing } = await supabase
        .from('notification_sent_logs')
        .select('id')
        .eq('fc_membership_id', m.id)
        .eq('renewal_deadline', deadlineDateStr)
        .eq('days_before', days)
        .maybeSingle()

      if (existing) { skipped++; continue }

      const { subject, html } = buildEmail(artistName, days, deadline, siteUrl)
      const { error: sendError } = await resend.emails.send({
        from: 'ライブログ <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      })

      if (!sendError) {
        await supabase.from('notification_sent_logs').insert({
          fc_membership_id: m.id,
          renewal_deadline: deadlineDateStr,
          days_before: days,
        })
        sent++
      }
    }
  }

  return NextResponse.json({ success: true, sent, skipped, checkedAt: new Date().toISOString() })
}
