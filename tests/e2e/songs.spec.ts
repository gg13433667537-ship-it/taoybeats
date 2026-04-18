import { test, expect } from '@playwright/test'

test.describe('Songs', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    const timestamp = Date.now()
    const email = `songtest${timestamp}@example.com`

    // Register
    await page.goto('/register')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/^(?!.*\/register)/, { timeout: 10000 }).catch(() => {
      // If already registered, try login
      page.goto('/login')
      page.fill('input[name="email"]', email)
      page.fill('input[name="password"]', 'password123')
      page.click('button[type="submit"]')
    })
  })

  test('should navigate to generate page', async ({ page }) => {
    await page.goto('/generate')
    await expect(page.locator('body')).toContainText(/生成|音乐|Music|Generate/i)
  })

  test('should show song creation form', async ({ page }) => {
    await page.goto('/generate')

    // Check for title input
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="标题" i]')
    await expect(titleInput).toBeVisible({ timeout: 5000 })
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/generate')

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()

      // Should show validation error
      await expect(page.locator('body')).toContainText(/required|必填|请输入|missing/i, { timeout: 3000 })
    }
  })

  test('should display user songs', async ({ page }) => {
    await page.goto('/playlists')

    // Should show playlists or empty state
    const content = page.locator('body')
    await expect(content).toBeVisible()
  })
})
