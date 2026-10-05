import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // 全ネットワークリクエストをキャプチャ
  const apiCalls: { url: string; method: string; status: number; body?: string }[] = []

  page.on('response', async (response) => {
    const url = response.url()
    const contentType = response.headers()['content-type'] ?? ''
    // JSON or API calls のみ記録
    if (contentType.includes('json') || url.includes('/api/') || url.includes('schedule')) {
      try {
        const body = await response.text()
        apiCalls.push({
          url,
          method: response.request().method(),
          status: response.status(),
          body: body.slice(0, 500),
        })
      } catch {
        apiCalls.push({ url, method: response.request().method(), status: response.status() })
      }
    }
  })

  console.log('Snow Man スケジュールページに移動...')
  await page.goto('https://starto.jp/s/p/media/list?ima=3821&tag=43&list[]=43&artist=43', {
    waitUntil: 'networkidle',
    timeout: 30000,
  })
  await page.waitForTimeout(5000)

  console.log(`\n=== キャプチャしたAPIコール: ${apiCalls.length}件 ===`)
  for (const call of apiCalls) {
    console.log(`\n[${call.method}] ${call.url}`)
    console.log(`  Status: ${call.status}`)
    if (call.body) console.log(`  Body: ${call.body.slice(0, 300)}`)
  }

  await browser.close()
}

main().catch(console.error)
