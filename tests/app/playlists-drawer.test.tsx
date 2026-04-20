import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PlaylistsPage from "@/app/(main)/playlists/page"

const pushMock = vi.fn()

const tMock = (key: string) => {
  const translations: Record<string, string> = {
    dashboard: "Dashboard",
    settings: "Settings",
    createPlaylist: "Create Playlist",
    myPlaylists: "My Playlists",
    noPlaylists: "No playlists",
  }

  return translations[key] || key
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: tMock,
  }),
}))

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("Playlists drawer", () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens a playlist drawer with song details instead of navigating away", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url === "/api/playlists") {
        return createJsonResponse({
          playlists: [
            {
              id: "playlist-1",
              name: "Night Mix",
              description: "Late drive songs",
              isPublic: false,
              songIds: ["song-1"],
              songCount: 1,
              createdAt: "2026-04-19T00:00:00.000Z",
              updatedAt: "2026-04-19T00:00:00.000Z",
            },
          ],
        })
      }

      if (url === "/api/playlists/playlist-1/songs") {
        return createJsonResponse({
          songs: [
            {
              id: "song-1",
              title: "Night Drive",
              status: "COMPLETED",
              audioUrl: "https://cdn.example.com/night-drive.mp3",
            },
          ],
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    render(<PlaylistsPage />)

    fireEvent.click(await screen.findByText("Night Mix"))

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /night mix/i })).toBeVisible()
    })

    expect(screen.getByText("Night Drive")).toBeVisible()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
