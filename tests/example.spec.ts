import { expect, test } from '@playwright/test'

test('playwright.dev has a title', async ({ page }) => {
  await page.goto('https://playwright.dev/')
  await expect(page).toHaveTitle(/Playwright/)
})

test('get started link navigates to the intro', async ({ page }) => {
  await page.goto('https://playwright.dev/')
  await page.getByRole('link', { name: 'Get started' }).click()
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible()
})
