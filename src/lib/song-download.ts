function getFilenameFromDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i)
  return plainMatch?.[1]?.trim() || null
}

export async function downloadSongFile({
  songId,
  shareToken,
  fallbackFilename,
}: {
  songId: string
  shareToken?: string
  fallbackFilename?: string
}) {
  const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ""
  const response = await fetch(`/api/songs/${songId}/download${query}`)

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || payload?.message || `Download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  const responseFilename = getFilenameFromDisposition(response.headers.get("content-disposition"))

  link.href = downloadUrl
  link.download = responseFilename || fallbackFilename || "audio"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}
