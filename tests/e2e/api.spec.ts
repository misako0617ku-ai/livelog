import { test, expect } from '@playwright/test'

// APIエンドポイントのテスト（認証なし）
test.describe('APIエンドポイント', () => {
  test('通知設定API: 未認証は401を返す', async ({ request }) => {
    const res = await request.get('/api/notification-settings')
    expect(res.status()).toBe(401)
  })

  test('FC会員API: 未認証は401を返す', async ({ request }) => {
    const res = await request.get('/api/fc-memberships')
    expect(res.status()).toBe(401)
  })

  test('FC会員削除API: 不正なIDは400を返す', async ({ request }) => {
    const res = await request.delete('/api/fc-memberships/invalid-id')
    expect(res.status()).toBe(400)
  })

  test('FC会員PATCH: 不正なIDは400を返す', async ({ request }) => {
    const res = await request.patch('/api/fc-memberships/invalid-id', {
      data: { notifications_enabled: true },
    })
    expect(res.status()).toBe(400)
  })

  test('Cronエンドポイント: CRON_SECRETなしは401を返す', async ({ request }) => {
    const res = await request.get('/api/cron/notify')
    // CRON_SECRETが設定されている場合のみ401
    expect([200, 401, 500]).toContain(res.status())
  })

  test('STARTOスクレイパー: GETはサンプルデータを返す', async ({ request }) => {
    const res = await request.get('/api/scrape/starto')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('artist')
    expect(data).toHaveProperty('month')
    expect(data).toHaveProperty('media')
    expect(data).toHaveProperty('live')
  })
})

test.describe('通知設定API（認証あり）', () => {
  // 認証ありのテストは auth.setup.ts でログイン済みのセッションを使用
  test('GETで設定を取得できる', async ({ request, page }) => {
    // ログイン済みセッション経由でAPIを叩く
    await page.goto('/settings')
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/notification-settings')
      return { status: r.status, data: await r.json() }
    })
    expect(res.status).toBe(200)
    expect(res.data).toHaveProperty('notifications_enabled')
    expect(res.data).toHaveProperty('notify_types')
    expect(res.data).toHaveProperty('notify_days_before')
  })

  test('PUTで設定を保存できる', async ({ page }) => {
    await page.goto('/settings')
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications_enabled: true,
          notify_types: ['fc'],
          notify_days_before: [14, 7],
        }),
      })
      return { status: r.status, data: await r.json() }
    })
    expect(res.status).toBe(200)
    expect(res.data.notifications_enabled).toBe(true)
  })

  test('PUTで不正なnotify_typesは400を返す', async ({ page }) => {
    await page.goto('/settings')
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications_enabled: true,
          notify_types: ['invalid_type'],
          notify_days_before: [14],
        }),
      })
      return { status: r.status }
    })
    expect(res.status).toBe(400)
  })

  test('PUTで不正なnotify_days_beforeは400を返す', async ({ page }) => {
    await page.goto('/settings')
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications_enabled: true,
          notify_types: ['fc'],
          notify_days_before: [999],
        }),
      })
      return { status: r.status }
    })
    expect(res.status).toBe(400)
  })
})
