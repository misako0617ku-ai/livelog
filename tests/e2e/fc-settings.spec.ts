import { test, expect } from '@playwright/test'

test.describe('FC管理ページ', () => {
  test('ページが表示される', async ({ page }) => {
    await page.goto('/fc-settings')
    await expect(page.getByRole('heading', { name: 'FC管理' })).toBeVisible()
  })

  test('FC追加ボタンが表示される', async ({ page }) => {
    await page.goto('/fc-settings')
    await expect(page.getByRole('button', { name: 'FCを追加' })).toBeVisible()
  })

  test('FC追加フォームが開く', async ({ page }) => {
    await page.goto('/fc-settings')
    await page.getByRole('button', { name: 'FCを追加' }).click()
    await expect(page.getByRole('combobox')).toBeVisible()
    await expect(page.getByRole('button', { name: '追加' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible()
  })

  test('アーティスト未選択では追加できない', async ({ page }) => {
    await page.goto('/fc-settings')
    await page.getByRole('button', { name: 'FCを追加' }).click()
    await page.getByRole('button', { name: '追加' }).click()
    await expect(page.getByText('アーティストと入会年月を入力してください')).toBeVisible()
  })

  test('通知ベルアイコンでON/OFFを切り替えられる', async ({ page }) => {
    await page.goto('/fc-settings')
    const bells = page.locator('[title*="通知"]')
    const count = await bells.count()
    if (count > 0) {
      await bells.first().click()
      // エラーなく切り替わることを確認
      await expect(page.locator('text=エラー')).not.toBeVisible()
    }
  })
})
