import { describe, expect, it } from "vitest"
import { getLyricsLimitForModel, prepareLyricsForModel } from "@/lib/minimax-music"

describe("MiniMax music lyrics preparation", () => {
  it("does not compress lyrics that stay within the official model limit even when they have many lines", () => {
    const lyrics = Array.from({ length: 90 }, (_, index) => `Line ${index + 1}`).join("\n")

    const result = prepareLyricsForModel({
      lyrics,
      model: "music-2.6",
      isInstrumental: false,
    })

    expect(getLyricsLimitForModel("music-2.6", false)).toBe(3500)
    expect(result.applied).toBe(false)
    expect(result.lyrics).toBe(lyrics)
    expect(result.originalLyrics).toBeUndefined()
    expect(result.reason).toBeNull()
  })

  it("compresses only when lyrics exceed the official limit and keeps the result close to the limit", () => {
    const lyrics = Array.from({ length: 260 }, (_, index) => `Verse line ${index + 1} keeps the story moving forward.`).join("\n")

    const result = prepareLyricsForModel({
      lyrics,
      model: "music-2.6",
      isInstrumental: false,
    })

    expect(result.applied).toBe(true)
    expect(result.reason).toBe("lyrics_over_model_limit")
    expect(result.originalLyrics).toBe(lyrics)
    expect(result.originalLength).toBeGreaterThan(3500)
    expect(result.compressedLength).toBeLessThanOrEqual(3500)
    expect(result.compressedLength).toBeGreaterThan(3200)
    expect(result.lyrics).toContain("Verse line 1")
    expect(result.lyrics).toContain("Verse line 40")
  })
})
