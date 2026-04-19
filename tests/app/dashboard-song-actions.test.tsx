/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DashboardPage from "@/app/(main)/dashboard/page"

const pushMock = vi.fn()
const showToastMock = vi.fn()

const tMock = (key: string) => {
  const translations: Record<string, string> = {
    dashboard: "Dashboard",
    mySongs: "My Songs",
    noSongsYet: "No songs yet",
    ready: "Ready",
    failed: "Failed",
    status: "Status",
    playSong: "Play Song",
    downloadSong: "Download Song",
    shareSong: "Share Song",
    copied: "Copied",
    deleteSong: "Delete Song",
    addToPlaylist: "Add to playlist",
    noPlaylists: "No playlists",
    playlists: "Playlists",
    loadDataFailed: "Failed to load data",
  }

  return translations[key] || key
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: tMock,
    lang: "en",
  }),
}))

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

vi.mock("@/components/Toast", () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}))

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

function createFetchMock(options?: {
  downloadResponse?: Response
  deleteHandler?: () => Promise<Response>
}) {
  let songsAfterDelete = false

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = init?.method || "GET"

    if (url === "/api/auth/profile") {
      return createJsonResponse({
        user: { id: "user-1", role: "USER", email: "user@example.com", name: "Test User" },
      })
    }

    if (url === "/api/songs" && method === "GET") {
      return createJsonResponse({
        songs: songsAfterDelete
          ? []
          : [{
              id: "song-1",
              title: "Night Drive",
              status: "COMPLETED",
              createdAt: "2026-04-19T12:00:00.000Z",
              audioUrl: "https://cdn.example.com/night-drive.mp3",
              genre: ["Synthwave"],
              shareToken: "share-1",
            }],
      })
    }

    if (url === "/api/usage") {
      return createJsonResponse({
        tier: "FREE",
        daily: { used: 1, limit: 5, remaining: 4, unlimited: false },
        monthly: { used: 1, limit: 10, remaining: 9, unlimited: false },
        output: { successfulToday: 1, successfulThisMonth: 1 },
      })
    }

    if (url === "/api/playlists") {
      return createJsonResponse({ playlists: [] })
    }

    if (url === "/api/songs/song-1/download") {
      return options?.downloadResponse
        ?? new Response(JSON.stringify({ error: "Download failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
    }

    if (url === "/api/songs/song-1" && method === "DELETE") {
      const response = await (options?.deleteHandler?.() ?? Promise.resolve(new Response(null, { status: 200 })))
      if (response.ok) {
        songsAfterDelete = true
      }
      return response
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`)
  })
}

describe("Dashboard song actions", () => {
  let anchorClickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    pushMock.mockReset()
    showToastMock.mockReset()
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    vi.stubGlobal(
      "URL",
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn(() => "blob:dashboard-download"),
        revokeObjectURL: vi.fn(),
      })
    )
  })

  afterEach(() => {
    anchorClickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it("shows an error toast when downloading a song fails", async () => {
    vi.stubGlobal("fetch", createFetchMock())

    render(<DashboardPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Download Song" }))

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("error", expect.stringContaining("Download"))
    })
  })

  it("sends a delete request for the selected song", async () => {
    const fetchMock = createFetchMock({
      deleteHandler: () => Promise.resolve(createJsonResponse({}, { status: 200 })),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<DashboardPage />)

    fireEvent.click(await screen.findByRole("button", { name: "More options" }))
    fireEvent.mouseDown(await screen.findByRole("button", { name: "Delete Song" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/songs/song-1", expect.objectContaining({ method: "DELETE" }))
    })
  })
})
