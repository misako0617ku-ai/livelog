import { test, expect } from '@playwright/test'

test.describe('通知設定ページ', () => {
  test('ページが表示される', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible()
  })

  test('通知をONにできる', async ({ page }) => {
    await page.goto('/settings')
    const toggle = page.getByTestId('notification-toggle')
    const isOn = await toggle.evaluate(el =>
      el.classList.contains('bg-pink-600')
    )
    if (!isOn) await toggle.click()
    await expect(page.getByTestId('type-fc')).toBeVisible()
    await expect(page.getByTestId('type-live')).toBeVisible()
    await expect(page.getByTestId('type-all')).toBeVisible()
  })

  test('通知種類を選択できる', async ({ page }) => {
    await page.goto('/settings')
    const toggle = page.getByTestId('notification-toggle')
    const isOn = await toggle.evaluate(el => el.classList.contains('bg-pink-600'))
    if (!isOn) await toggle.click()

    const liveCheckbox = page.getByTestId('type-live')
    await liveCheckbox.check()
    await expect(liveCheckbox).toBeChecked()

    const allCheckbox = page.getByTestId('type-all')
    await allCheckbox.check()
    await expect(allCheckbox).toBeChecked()
  })

  test('通知タイミングを選択できる', async ({ page }) => {
    await page.goto('/settings')
    const toggle = page.getByTestId('notification-toggle')
    const isOn = await toggle.evaluate(el => el.classList.contains('bg-pink-600'))
    if (!isOn) await toggle.click()

    await page.getByTestId('day-3').click()
    await page.getByTestId('day-0').click()

    await expect(page.getByTestId('day-3')).toHaveClass(/bg-pink-50/)
    await expect(page.getByTestId('day-0')).toHaveClass(/bg-pink-50/)
  })

  test('設定を保存できる', async ({ page }) => {
    await page.goto('/settings')
    const toggle = page.getByTestId('notification-toggle')
    const isOn = await toggle.evaluate(el => el.classList.contains('bg-pink-600'))
    if (!isOn) await toggle.click()

    await page.getByTestId('type-fc').check()
    await page.getByTestId('day-14').click()

    await page.getByTestId('save-button').click()
    await expect(page.getByText('✅ 保存しました')).toBeVisible()
  })

  test('ページリロード後も設定が保持される', async ({ page }) => {
    // 保存
    await page.goto('/settings')
    const toggle = page.getByTestId('notification-toggle')
    const isOn = await toggle.evaluate(el => el.classList.contains('bg-pink-600'))
    if (!isOn) await toggle.click()
    await page.getByTestId('type-live').check()
    await page.getByTestId('save-button').click()
    await expect(page.getByText('✅ 保存しました')).toBeVisible()

    // リロード後確認
    await page.reload()
    await expect(page.getByTestId('type-live')).toBeChecked()
  })
})
