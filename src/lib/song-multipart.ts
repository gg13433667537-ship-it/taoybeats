export interface MultiPartInfo {
  isMultiPart: boolean
  partGroupId: string
  totalParts: number
  parts: { id: string; part: number }[]
}

export function resolveMultiPartPollingInfo(
  responseMultiPart: MultiPartInfo | null | undefined,
  currentMultiPartInfo: MultiPartInfo | null | undefined
): MultiPartInfo | null {
  const candidate = responseMultiPart ?? currentMultiPartInfo

  if (!candidate || !candidate.isMultiPart || candidate.totalParts <= 1 || candidate.parts.length <= 1) {
    return null
  }

  return candidate
}
