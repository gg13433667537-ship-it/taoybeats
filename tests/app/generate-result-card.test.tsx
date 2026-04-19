import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pushMock = vi.fn()
const searchParamsMock = {
  get: vi.fn(() => null),
}

const toastMock = {
  showToast: vi.fn(),
}

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  emitMessage(data: Record<string, unknown>) {
    this.onmessage?.({
      data: JSON.stringify(data),
    } as MessageEvent<string>)
  }

  close() {}
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}))

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    lang: "en",
  }),
}))

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

vi.mock("@/components/AudioPlayer", () => ({
  default: ({ src }: { src?: string }) => (
    <div data-testid="audio-player">{src || "no-audio"}</div>
  ),
}))

vi.mock("@/components/LyricsAssistantModal", () => ({
  default: () => null,
}))

vi.mock("@/components/LoginGuideModal", () => ({
  default: () => null,
}))

vi.mock("@/components/VoiceSelector", () => ({
  default: () => <div data-testid="voice-selector" />,
}))

vi.mock("@/components/PersonaSelector", () => ({
  default: () => <div data-testid="persona-selector" />,
}))

vi.mock("@/components/AdvancedOptions", () => ({
  default: () => <div data-testid="advanced-options" />,
}))

vi.mock("@/components/GenerationProgress", () => ({
  default: () => <div data-testid="generation-progress" />,
}))

vi.mock("@/components/Toast", () => ({
  useToast: () => toastMock,
}))

vi.mock("@/lib/usePresets", () => ({
  usePresets: () => ({
    presets: [],
    createPreset: vi.fn(),
  }),
}))

vi.mock("@/components/SelectorDrawer", async () => {
  const ReactModule = await import("react")

  function MockSelectorDrawer({
    isOpen,
    options,
    selectedValues,
    onConfirm,
    onClose,
    multiSelect = true,
  }: {
    isOpen: boolean
    options: Array<{ value: string; label: string }>
    selectedValues: string[]
    onConfirm: (values: string[]) => void
    onClose: () => void
    multiSelect?: boolean
  }) {
    const [localSelected, setLocalSelected] = ReactModule.useState<string[]>(selectedValues)

    ReactModule.useEffect(() => {
      setLocalSelected(selectedValues)
    }, [isOpen, selectedValues])

    if (!isOpen) return null

    return (
      <div data-testid="mock-selector-drawer">
        {options.map((option) => (
          <button
            key={option.value}
            data-testid={`selector-option-${option.value}`}
            onClick={() => {
              if (multiSelect) {
                setLocalSelected((current) => (
                  current.includes(option.value)
                    ? current.filter((value) => value !== option.value)
                    : [...current, option.value]
                ))
                return
              }

              onConfirm([option.value])
              onClose()
            }}
          >
            {option.label}
          </button>
        ))}
        {multiSelect ? (
          <button
            data-testid="selector-confirm"
            onClick={() => {
              onConfirm(localSelected)
              onClose()
            }}
          >
            confirm
          </button>
        ) : null}
      </div>
    )
  }

  return {
    default: MockSelectorDrawer,
  }
})

import GeneratePage from "@/app/(main)/generate/page"

describe("Generate page result card", () => {
  beforeEach(() => {
    MockEventSource.instances = []
    pushMock.mockReset()
    searchParamsMock.get.mockReset()
    searchParamsMock.get.mockReturnValue(null)
    toastMock.showToast.mockReset()
    vi.stubGlobal("EventSource", MockEventSource)
  })

  it("shows a compression warning and renders a single clean result card", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/auth/profile") {
        return new Response(JSON.stringify({ user: { id: "user-1", role: "USER" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url === "/api/songs" && init?.method === "POST") {
        return new Response(JSON.stringify({
          id: "song-1",
          status: "GENERATING",
          compression: {
            applied: true,
            reason: "lyrics_too_long",
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    render(<GeneratePage />)

    fireEvent.change(screen.getByTestId("song-title-input"), {
      target: { value: "Single Pass Song" },
    })
    fireEvent.change(screen.getByTestId("lyrics-input"), {
      target: { value: Array.from({ length: 180 }, (_, index) => `Line ${index + 1} for a very long lyric`).join("\n") },
    })

    fireEvent.click(screen.getByTestId("genre-selector-trigger"))
    fireEvent.click(screen.getByTestId("selector-option-Pop"))
    fireEvent.click(screen.getByTestId("selector-confirm"))

    fireEvent.click(screen.getByTestId("mood-selector-trigger"))
    fireEvent.click(screen.getByTestId("selector-option-Happy"))

    fireEvent.click(screen.getByTestId("generate-song-button"))

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1)
    })

    expect(toastMock.showToast).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("自动压缩")
    )

    act(() => {
      MockEventSource.instances[0].emitMessage({
        status: "COMPLETED",
        progress: 100,
        stage: "completed",
        audioUrl: "https://cdn.example.com/song-1.mp3",
        songId: "song-1",
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId("audio-player")).toHaveTextContent("https://cdn.example.com/song-1.mp3")
    })

    expect(screen.queryByText(/Part 1\//i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Multi-part song detected/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /download/i })).toBeVisible()
    expect(screen.getByRole("button", { name: /share/i })).toBeVisible()
  })
})
