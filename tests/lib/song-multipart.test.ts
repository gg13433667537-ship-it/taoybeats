import { describe, expect, it } from "vitest"
import { resolveMultiPartPollingInfo, type MultiPartInfo } from "@/lib/song-multipart"

const multiPartInfo: MultiPartInfo = {
  isMultiPart: true,
  partGroupId: "group-1",
  totalParts: 3,
  parts: [
    { id: "song-1", part: 1 },
    { id: "song-2", part: 2 },
    { id: "song-3", part: 3 },
  ],
}

describe("resolveMultiPartPollingInfo", () => {
  it("prefers the fresh create-response multi-part info when state is still stale", () => {
    expect(resolveMultiPartPollingInfo(multiPartInfo, null)).toEqual(multiPartInfo)
  })

  it("falls back to the existing state when the create response does not include multi-part data", () => {
    expect(resolveMultiPartPollingInfo(null, multiPartInfo)).toEqual(multiPartInfo)
  })

  it("returns null when the song is not actually multi-part", () => {
    expect(
      resolveMultiPartPollingInfo(
        {
          ...multiPartInfo,
          isMultiPart: false,
          totalParts: 1,
        },
        null
      )
    ).toBeNull()
  })
})
