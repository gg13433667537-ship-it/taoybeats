interface QueuedUpload {
  songId: string
  audioUrl: string
  attempts: number
  maxRetries: number
  createdAt: number
}

const uploadQueue: QueuedUpload[] = []
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 2000

/**
 * Add an upload to the background queue
 */
export function queueR2Upload(songId: string, audioUrl: string): void {
  // Don't queue if already in queue for this song
  if (uploadQueue.some(u => u.songId === songId)) {
    return
  }
  uploadQueue.push({
    songId,
    audioUrl,
    attempts: 0,
    maxRetries: MAX_RETRIES,
    createdAt: Date.now(),
  })
  // Start processing if not already
  processQueue()
}

/**
 * Check if a song is pending upload
 */
export function isPendingUpload(songId: string): boolean {
  return uploadQueue.some(u => u.songId === songId)
}

/**
 * Process the upload queue
 */
async function processQueue(): Promise<void> {
  if (uploadQueue.length === 0) return

  const upload = uploadQueue[0]

  try {
    const { uploadAudioFromUrl } = await import('./r2-storage')
    const r2Url = await uploadAudioFromUrl(upload.audioUrl, upload.songId)

    // Update song's audioUrl to R2 URL
    await updateSongAudioUrl(upload.songId, r2Url)

    // Remove from queue on success
    uploadQueue.shift()
    console.log(`[R2Queue] Song ${upload.songId} uploaded to R2: ${r2Url}`)
  } catch (error) {
    upload.attempts++
    console.error(`[R2Queue] Song ${upload.songId} upload failed (attempt ${upload.attempts}/${upload.maxRetries}):`, error)

    if (upload.attempts >= upload.maxRetries) {
      uploadQueue.shift()
      console.error(`[R2Queue] Song ${upload.songId} upload failed after ${upload.maxRetries} attempts`)
    } else {
      // Move to end of queue and retry after delay
      uploadQueue.shift()
      uploadQueue.push(upload)
      setTimeout(processQueue, RETRY_DELAY_MS)
    }
  }

  // Process next if queue not empty
  if (uploadQueue.length > 0) {
    setTimeout(processQueue, RETRY_DELAY_MS)
  }
}

/**
 * Update song's audioUrl in database
 */
async function updateSongAudioUrl(songId: string, audioUrl: string): Promise<void> {
  const { prisma } = await import('./db')
  const songsMap = (global as Record<string, unknown>).songs as Map<string, import('./types').Song> | undefined

  // Update memory cache
  const cachedSong = songsMap?.get(songId)
  if (cachedSong) {
    songsMap!.set(songId, { ...cachedSong, audioUrl })
  }

  // Update Prisma
  try {
    await prisma.song.update({
      where: { id: songId },
      data: { audioUrl },
    })
  } catch (error) {
    console.error(`[R2Queue] Failed to update Prisma for song ${songId}:`, error)
  }
}

/**
 * Synchronously upload and wait for completion (for download path)
 */
export async function uploadAndWaitForR2(songId: string, audioUrl: string): Promise<string> {
  // If already points to R2, return immediately
  if (isR2Url(audioUrl)) {
    return audioUrl
  }

  // If R2 is not configured, return original URL immediately
  // This allows songs to still work (play/download) even without R2
  const { isR2Configured } = await import('./r2-storage')
  if (!isR2Configured()) {
    console.log(`[R2Queue] R2 not configured, using original URL for song ${songId}`)
    return audioUrl
  }

  // If already in queue, wait for it
  if (isPendingUpload(songId)) {
    return waitForUpload(songId)
  }

  // Otherwise, do synchronous upload
  const { uploadAudioFromUrl } = await import('./r2-storage')
  const r2Url = await uploadAudioFromUrl(audioUrl, songId)
  await updateSongAudioUrl(songId, r2Url)
  return r2Url
}

function isR2Url(url: string): boolean {
  const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
  return r2PublicUrl.length > 0 && url.startsWith(r2PublicUrl)
}

async function waitForUpload(songId: string, maxWaitMs = 60000): Promise<string> {
  const startTime = Date.now()
  while (Date.now() - startTime < maxWaitMs) {
    // Only proceed if upload is no longer pending
    if (!isPendingUpload(songId)) {
      const songsMap = (global as Record<string, unknown>).songs as Map<string, import('./types').Song> | undefined
      const song = songsMap?.get(songId)
      if (song?.audioUrl && isR2Url(song.audioUrl)) {
        return song.audioUrl
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`R2 upload timed out for song ${songId}`)
}
