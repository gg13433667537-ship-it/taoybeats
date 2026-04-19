/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

async function loadDownloadSongFile() {
  const moduleUrl = pathToFileURL(resolve(process.cwd(), "src/lib/song-download.ts")).href
  const module = await import(/* @vite-ignore */ moduleUrl)
  return module.downloadSongFile
}

describe("song download helper", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    vi.stubGlobal(
      "URL",
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn(() => "blob:mock-song"),
        revokeObjectURL: vi.fn(),
      })
    )
  })

  afterEach(() => {
    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it("throws on non-ok responses instead of saving the error payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    )

    vi.stubGlobal("fetch", fetchMock)

    const downloadSongFile = await loadDownloadSongFile()

    await expect(downloadSongFile({ songId: "song-1", fallbackFilename: "song.mp3" })).rejects.toThrow(
      "Internal server error"
    )

    expect(fetchMock).toHaveBeenCalledWith("/api/songs/song-1/download")
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it("downloads a blob only when the proxy response is ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["audio"]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    )

    vi.stubGlobal("fetch", fetchMock)

    const downloadSongFile = await loadDownloadSongFile()

    await downloadSongFile({ songId: "song-1", fallbackFilename: "song.mp3" })

    expect(fetchMock).toHaveBeenCalledWith("/api/songs/song-1/download")
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-song")
  })
})
