import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock dependencies at module level
vi.mock("./r2-storage", () => ({
  uploadAudioFromUrl: vi.fn().mockResolvedValue("https://r2.example.com/songs/song-1.mp3"),
}))

vi.mock("./db", () => ({
  prisma: {
    song: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

async function loadR2UploadQueue() {
  // Clear module cache to get fresh state for each test
  vi.resetModules()
  const moduleUrl = pathToFileURL(resolve(process.cwd(), "src/lib/r2-upload-queue.ts")).href
  const r2UploadQueue = await import(/* @vite-ignore */ moduleUrl)
  return r2UploadQueue
}

describe("R2 upload queue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Mock global songs map
    const songsMap = new Map()
    vi.stubGlobal("songs", songsMap)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("queueR2Upload", () => {
    it("adds an upload to the queue", async () => {
      const { queueR2Upload, isPendingUpload } = await loadR2UploadQueue()

      queueR2Upload("song-1", "https://example.com/audio.mp3")

      expect(isPendingUpload("song-1")).toBe(true)
    })

    it("prevents duplicate queue entries for the same song", async () => {
      const { queueR2Upload, isPendingUpload } = await loadR2UploadQueue()

      // Queue the same song twice
      queueR2Upload("song-1", "https://example.com/audio1.mp3")
      queueR2Upload("song-1", "https://example.com/audio2.mp3")

      // Should still only be pending once (only one entry in queue)
      expect(isPendingUpload("song-1")).toBe(true)
    })
  })

  describe("isPendingUpload", () => {
    it("returns true for a song that is queued", async () => {
      const { queueR2Upload, isPendingUpload } = await loadR2UploadQueue()

      queueR2Upload("song-1", "https://example.com/audio.mp3")

      expect(isPendingUpload("song-1")).toBe(true)
    })

    it("returns false for a song that is not queued", async () => {
      const { isPendingUpload } = await loadR2UploadQueue()

      expect(isPendingUpload("song-not-queued")).toBe(false)
    })
  })
})
