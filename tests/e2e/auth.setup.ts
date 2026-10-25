import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

setup('ログイン状態を保存', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD が .env.local に設定されていません')
  }

  await page.goto('/auth/login')
  await page.getByLabel(/メールアドレス/i).fill(email)
  await page.getByLabel(/パスワード/i).fill(password)
  await page.getByRole('button', { name: /ログイン/i }).click()
  await page.waitForURL('**/calendar')

  await page.context().storageState({ path: authFile })
})
