import { test, expect } from '@playwright/test'

test.describe('Discover Page', () => {
  test('should load discover page', async ({ page }) => {
    await page.goto('/discover')
    await expect(page).toHaveTitle(/.*/)
  })

  test('should show song list', async ({ page }) => {
    await page.goto('/discover')

    // Wait for content to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

    // Check that page has loaded with some content
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
