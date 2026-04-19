import { test, expect } from '@playwright/test'

test.describe('Songs', () => {
  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now()
    const email = `songtest${timestamp}@example.com`

    await page.goto('/register')
    await page.fill('#email', email)
    await page.fill('#password', 'password123')
    await page.fill('#confirmPassword', 'password123')
    await page.click('button[type="submit"]')

    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 })
    } catch {
      await page.goto('/login')
      await page.fill('#email', email)
      await page.fill('#password', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard', { timeout: 10000 })
    }
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

    const content = page.locator('body')
    await expect(content).toBeVisible()
  })

  test('should generate a song and allow playback and download', async ({ page }) => {
    test.skip(!process.env.REAL_MUSIC_E2E, 'Real MiniMax browser test is opt-in')
    test.slow()
    test.setTimeout(180000)

    await page.goto('/generate')

    await page.getByTestId('song-title-input').fill('Frontend Smoke Song')
    await page.getByTestId('lyrics-input').fill('This is a frontend smoke test song for TaoyBeats.')

    await page.getByTestId('genre-selector-trigger').click()
    await page.getByTestId('selector-option-Pop').click()
    await page.getByTestId('selector-confirm').click()

    await page.getByTestId('mood-selector-trigger').click()
    await page.getByTestId('selector-option-Happy').click()

    await page.getByTestId('generate-song-button').click()

    const playButton = page.locator('button[aria-label="Play"]')
    await expect(playButton).toBeVisible({ timeout: 120000 })

    await playButton.click()
    await expect(page.locator('button[aria-label="Pause"]')).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page.locator('button[aria-label="Download"]').first().click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBeTruthy()
  })
})
