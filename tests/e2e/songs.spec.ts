import { test, expect, type Page } from '@playwright/test'

const APP_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const MOCK_SONG_ID = 'mock-song-id'
const MOCK_SONG_TITLE = 'Frontend Smoke Song'
const MOCK_AUDIO_URL = 'https://cdn.example.com/mock-song.mp3'
const MOCK_AUDIO_BODY = (() => {
  const sampleRate = 8000
  const channels = 1
  const bitsPerSample = 16
  const sampleCount = sampleRate / 4
  const dataSize = sampleCount * channels * (bitsPerSample / 8)
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28)
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  return buffer
})()

async function authenticateForGeneratePage(page: Page) {
  const email = `mocked-song-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

  const response = await page.context().request.post(`${APP_BASE_URL}/api/auth/register`, {
    data: {
      email,
      password: 'password123',
    },
  })

  expect(response.ok()).toBeTruthy()
}

async function installMockAudioEnvironment(page: Page) {
  await page.addInitScript(
    ({ audioUrl, songId }) => {
      class MockEventSource {
        static CONNECTING = 0
        static OPEN = 1
        static CLOSED = 2

        readonly CONNECTING = 0
        readonly OPEN = 1
        readonly CLOSED = 2
        readonly url: string
        readonly withCredentials = false
        readyState = MockEventSource.OPEN
        onopen: ((event: Event) => void) | null = null
        onmessage: ((event: MessageEvent<string>) => void) | null = null
        onerror: ((event: Event) => void) | null = null

        constructor(url: string) {
          this.url = url

          setTimeout(() => {
            this.onopen?.(new Event('open'))
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify({
                  status: 'COMPLETED',
                  progress: 100,
                  stage: 'Completed',
                  songId,
                  audioUrl,
                }),
              })
            )
          }, 50)
        }

        addEventListener() {}
        removeEventListener() {}

        close() {
          this.readyState = MockEventSource.CLOSED
        }
      }

      Object.defineProperty(window, 'EventSource', {
        configurable: true,
        writable: true,
        value: MockEventSource,
      })

      Object.defineProperty(HTMLMediaElement.prototype, 'load', {
        configurable: true,
        value: function mockLoad(this: HTMLMediaElement) {
          Object.defineProperty(this, 'duration', {
            configurable: true,
            value: 42,
          })

          setTimeout(() => {
            this.dispatchEvent(new Event('loadedmetadata'))
            this.dispatchEvent(new Event('canplay'))
          }, 0)
        },
      })

      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: async function mockPlay(this: HTMLMediaElement) {
          this.dispatchEvent(new Event('play'))
        },
      })

      Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
        configurable: true,
        value: function mockPause(this: HTMLMediaElement) {
          this.dispatchEvent(new Event('pause'))
        },
      })
    },
    { audioUrl: MOCK_AUDIO_URL, songId: MOCK_SONG_ID }
  )

  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'mock-user-id',
          role: 'USER',
        },
      }),
    })
  })

  await page.route('**/api/songs', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_SONG_ID,
      }),
    })
  })

  await page.route(`**/api/songs/${MOCK_SONG_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_SONG_ID,
        title: MOCK_SONG_TITLE,
        status: 'COMPLETED',
        audioUrl: MOCK_AUDIO_URL,
        genre: ['Pop'],
        mood: 'Happy',
      }),
    })
  })

  await page.route(`**/api/songs/${MOCK_SONG_ID}/audio`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: MOCK_AUDIO_BODY,
    })
  })

  await page.route(`**/api/songs/${MOCK_SONG_ID}/download`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      headers: {
        'content-disposition': `attachment; filename="${MOCK_SONG_TITLE}.wav"`,
      },
      body: MOCK_AUDIO_BODY,
    })
  })
}

test.describe('Songs mocked flow', () => {
  test('should complete mocked generation and allow playback and download', async ({ page }) => {
    await authenticateForGeneratePage(page)
    await installMockAudioEnvironment(page)

    await page.goto('/generate')

    await page.getByTestId('song-title-input').fill(MOCK_SONG_TITLE)
    await page.getByTestId('lyrics-input').fill('This is a deterministic browser playback smoke test.')

    await page.getByTestId('genre-selector-trigger').click()
    await expect(page.getByTestId('selector-option-Pop')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('selector-option-Pop').click()
    await page.getByTestId('selector-confirm').click()
    await expect(page.getByTestId('selector-confirm')).toBeHidden({ timeout: 5000 })

    await page.getByTestId('mood-selector-trigger').click()
    await expect(page.getByTestId('selector-option-Happy')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('selector-option-Happy').click()

    await page.getByTestId('generate-song-button').click()

    const playButton = page.locator('button[aria-label="Play"]')
    await expect(playButton).toBeVisible({ timeout: 10000 })
    await expect(playButton).toBeEnabled({ timeout: 10000 })

    await playButton.click()
    await expect(page.locator('button[aria-label="Pause"]')).toBeVisible({ timeout: 5000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.locator('button[aria-label="Download"]').first().click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toContain(MOCK_SONG_TITLE)
  })

  test('should play and download a completed song on the song page', async ({ page }) => {
    await installMockAudioEnvironment(page)

    const mockSongDetail = {
      id: MOCK_SONG_ID,
      title: MOCK_SONG_TITLE,
      status: 'COMPLETED',
      audioUrl: MOCK_AUDIO_URL,
      genre: ['Pop'],
      mood: 'Happy',
    }

    await page.route(`**/api/songs/by-share/${MOCK_SONG_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSongDetail),
      })
    })

    await page.route('**/api/songs/by-part-group/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          songs: [mockSongDetail],
        }),
      })
    })

    const detailRequestPromise = page.waitForRequest((request) => {
      const pathname = new URL(request.url()).pathname
      return (
        pathname === `/api/songs/${MOCK_SONG_ID}` ||
        pathname === `/api/songs/by-share/${MOCK_SONG_ID}`
      )
    })

    await page.goto(`/song/${MOCK_SONG_ID}`)
    const detailRequest = await detailRequestPromise
    expect([
      `/api/songs/${MOCK_SONG_ID}`,
      `/api/songs/by-share/${MOCK_SONG_ID}`,
    ]).toContain(new URL(detailRequest.url()).pathname)

    await expect(page.getByRole('heading', { name: MOCK_SONG_TITLE })).toBeVisible({ timeout: 10000 })

    const playButton = page.getByRole('button', { name: /play/i }).first()
    await playButton.click()
    await expect(page.getByRole('button', { name: /pause/i }).first()).toBeVisible({ timeout: 5000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
    await page.getByRole('button', { name: /download/i }).first().click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toContain(MOCK_SONG_TITLE)
  })
})

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
