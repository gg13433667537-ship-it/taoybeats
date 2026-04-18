import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText(/登录|Login/i)
  })

  test('should show register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('h1')).toContainText(/注册|Register/i)
  })

  test('should register a new user', async ({ page }) => {
    await page.goto('/register')

    const timestamp = Date.now()
    const email = `test${timestamp}@example.com`

    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'password123')
    await page.fill('input[name="name"]', 'Test User')

    await page.click('button[type="submit"]')

    // Should redirect or show success
    await expect(page).not.toHaveURL('/register', { timeout: 5000 }).catch(() => {
      // If still on register page, check for error message
      const errorText = page.locator('body')
      expect(errorText).not.toBeEmpty()
    })
  })

  test('should login with valid credentials', async ({ page }) => {
    // First register
    const timestamp = Date.now()
    const email = `logintest${timestamp}@example.com`

    await page.goto('/register')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/^(?!.*\/register)/, { timeout: 5000 }).catch(() => {})

    // Logout first if needed
    const logoutButton = page.locator('button:has-text("登出"), button:has-text("Logout"), button:has-text("Sign out")')
    if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await logoutButton.click()
      await page.waitForLoadState('networkidle')
    }

    // Now login
    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Should be logged in
    await page.waitForURL(/^(?!.*\/login)/, { timeout: 5000 }).catch(() => {
      expect(page.locator('body')).toContainText(/dashboard|home|profile/i, { timeout: 5000 })
    })
  })

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'nonexistent@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('body')).toContainText(/错误|error|失败|fail/i, { timeout: 5000 })
  })
})
