/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SongSharePage from "@/app/song/[id]/page"

const useParamsMock = vi.fn()
const tMock = (key: string) => {
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
    createdWith: "Created with",
    songNotFound: "Song not found",
    songRemovedOrInvalid: "Song removed or invalid",
    goToTaoyBeats: "Go to TaoyBeats",
    createYourOwn: "Create your own",
  }

  return translations[key] || key
}

vi.mock("next/navigation", () => ({
  useParams: () => useParamsMock(),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: tMock,
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

function createJsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  }
}

describe("Song detail page polling", () => {
  beforeEach(() => {
    useParamsMock.mockReturnValue({ id: "song-123" })
    vi.useFakeTimers()

    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    HTMLElement.prototype.scrollTo = vi.fn()

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

  function fireAudioCanplay() {
    const audio = document.querySelector("audio")
    if (audio) {
      Object.defineProperty(audio, "duration", { value: 120, configurable: true })
      act(() => {
        audio.dispatchEvent(new Event("canplay"))
      })
    }
  }

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("refreshes a generating song until playback becomes available", async () => {
    let currentSongResponse = {
      id: "song-123",
      title: "Polling Song",
      status: "GENERATING",
      genre: ["Pop"],
      mood: "Focused",
    }

    const fetchMock = vi.fn().mockImplementation(async () => createJsonResponse(currentSongResponse))

    vi.stubGlobal("fetch", fetchMock)

    render(<SongSharePage />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByRole("heading", { name: "Polling Song" })).toBeInTheDocument()
    // Player is not rendered while generating (no audioUrl)
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()

    const initialFetchCount = fetchMock.mock.calls.length

    currentSongResponse = {
        id: "song-123",
        title: "Polling Song",
        status: "COMPLETED",
        audioUrl: "https://cdn.example.com/polling-song.mp3",
        genre: ["Pop"],
        mood: "Focused",
      }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    // Let the audio canplay event fire so the player becomes interactive
    fireAudioCanplay()

    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialFetchCount)
    // Player is rendered after generation completes
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled()
  })
})
