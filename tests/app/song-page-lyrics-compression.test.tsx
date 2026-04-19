/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SongSharePage from "@/app/song/[id]/page"

const useParamsMock = vi.fn()

vi.mock("next/navigation", () => ({
  useParams: () => useParamsMock(),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        play: "Play",
        pause: "Pause",
        mute: "Mute",
        unmute: "Unmute",
        download: "Download",
        share: "Share",
        generatingEllipsis: "Generating...",
        audioNotAvailable: "Audio not available",
        lyrics: "Lyrics",
        originalLyrics: "Original Lyrics",
      }

      return translations[key] || key
    },
  }),
}))

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

vi.mock("@/components/AdvancedAudioEditor", () => ({
  default: () => <div data-testid="advanced-audio-editor" />,
}))

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
  SHORTCUTS: {
    PLAY_PAUSE: (action: () => void) => ({ key: " ", action }),
    SHARE: (action: () => void) => ({ key: "s", ctrl: true, action }),
    DOWNLOAD: (action: () => void) => ({ key: "d", ctrl: true, action }),
    MUTE: (action: () => void) => ({ key: "m", ctrl: true, action }),
    CLOSE_MODAL: (action: () => void) => ({ key: "Escape", action }),
  },
}))

describe("Song detail lyrics rendering", () => {
  beforeEach(() => {
    useParamsMock.mockReturnValue({ id: "song-lyrics-1" })
    vi.useFakeTimers()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        clearRect: vi.fn(),
        fill: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fillStyle: "",
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows both the generated lyrics and the original lyrics when compression was applied", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "song-lyrics-1",
        title: "Compressed Song",
        status: "COMPLETED",
        audioUrl: "https://cdn.example.com/song.mp3",
        genre: ["Pop"],
        mood: "Focused",
        lyrics: "[Verse]\nThis is the lyrics actually sent to MiniMax.",
        originalLyrics: "[Verse]\nThis is the original long lyrics before compression.\n[Verse]\nMore original lines.",
        lyricsCompressionApplied: true,
      }),
    }))

    render(<SongSharePage />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText("Lyrics")).toBeInTheDocument()
    expect(screen.getByText("Original Lyrics")).toBeInTheDocument()
    expect(screen.getByText("This is the lyrics actually sent to MiniMax.", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("This is the original long lyrics before compression.", { exact: false })).toBeInTheDocument()
  })
})
