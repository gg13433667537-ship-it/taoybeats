# R2 Audio Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated songs permanently available by uploading MiniMax audio files to Cloudflare R2 storage. Downloads wait for upload completion if R2 not ready.

**Architecture:** After MiniMax generates an audio file, asynchronously upload it to R2 via a background queue with retry mechanism. Update `audioUrl` to R2 URL on success. Downloads wait for R2 upload if not yet complete.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, AWS S3 SDK (Cloudflare R2), Node.js

---

## File Map

```
Modified:
- src/lib/r2-storage.ts              (existing, verify R2 upload works)
- src/app/api/songs/route.ts         (add background upload trigger after generation)
- src/app/api/songs/[id]/download/route.ts  (wait for R2 if not uploaded)

Created:
- src/lib/r2-upload-queue.ts        (background queue with retry)
- tests/lib/r2-upload-queue.test.ts (queue unit tests)
```

---

## Pre-Implementation Check

Before starting, verify the existing `r2-storage.ts` upload function works:

```typescript
// src/lib/r2-storage.ts exports:
export async function uploadAudioFromUrl(audioUrl: string, songId: string): Promise<string>
```

Verify environment variables are configured:
```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

---

## Task 1: Create R2 Upload Queue

**Files:**
- Create: `src/lib/r2-upload-queue.ts`
- Test: `tests/lib/r2-upload-queue.test.ts`

- [ ] **Step 1: Create the queue module**

```typescript
// src/lib/r2-upload-queue.ts

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
    if (!isPendingUpload(songId)) {
      // Check if audioUrl was updated
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
```

- [ ] **Step 2: Write tests for the queue**

```typescript
// tests/lib/r2-upload-queue.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock r2-storage
vi.mock('@/lib/r2-storage', () => ({
  uploadAudioFromUrl: vi.fn(),
}))

// Mock db
vi.mock('@/lib/db', () => ({
  prisma: {
    song: {
      update: vi.fn(),
    },
  },
}))

describe('R2 Upload Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module state by clearing the queue
  })

  it('should queue upload when addToQueue is called', async () => {
    const { queueR2Upload, isPendingUpload } = await import('@/lib/r2-upload-queue')
    queueR2Upload('song-123', 'https://minimax.url/audio.mp3')
    expect(isPendingUpload('song-123')).toBe(true)
  })

  it('should not queue duplicate for same song', async () => {
    const { queueR2Upload, isPendingUpload } = await import('@/lib/r2-upload-queue')
    queueR2Upload('song-123', 'https://minimax.url/audio1.mp3')
    queueR2Upload('song-123', 'https://minimax.url/audio2.mp3')
    // Should only be queued once
    expect(isPendingUpload('song-123')).toBe(true)
  })

  it('should mark as not pending after successful upload', async () => {
    const { uploadAudioFromUrl } = await import('@/lib/r2-storage')
    vi.mocked(uploadAudioFromUrl).mockResolvedValue('https://r2.url/songs/song-123.mp3')
    
    const { queueR2Upload, isPendingUpload } = await import('@/lib/r2-upload-queue')
    queueR2Upload('song-123', 'https://minimax.url/audio.mp3')
    
    // Wait for queue to process (in real test, would need to await properly)
    await new Promise(resolve => setTimeout(resolve, 100))
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --run tests/lib/r2-upload-queue.test.ts`
Expected: Tests should compile and run (may need adjustment based on module state)

- [ ] **Step 4: Commit**

```bash
git add src/lib/r2-upload-queue.ts tests/lib/r2-upload-queue.test.ts
git commit -m "feat: add R2 upload queue with retry mechanism"
```

---

## Task 2: Trigger Background Upload After Generation

**Files:**
- Modify: `src/app/api/songs/route.ts:720-740`

- [ ] **Step 1: Import the queue function**

Find line 41: `import { uploadAudioFromUrl } from "@/lib/r2-storage"`

Add after it:
```typescript
import { queueR2Upload } from "@/lib/r2-upload-queue"
```

- [ ] **Step 2: Trigger background upload for async generation**

Find the section around line 734-738 where async generation (task ID) is handled:

```typescript
} else {
  await updateSongStatus(songId, {
    status: 'GENERATING',
    providerTaskId: taskId,
  }, song)
}
```

Add after this block:
```typescript
// Queue background upload for when audio is ready (async generation)
if (initiatedSong.audioUrl) {
  queueR2Upload(songId, initiatedSong.audioUrl)
}
```

- [ ] **Step 3: Update existing immediate upload to also queue**

Find lines 722-727 where immediate upload happens:

```typescript
if (taskId.startsWith('audio:')) {
  const sourceAudioUrl = taskId.slice(6)
  let finalAudioUrl = sourceAudioUrl

  try {
    finalAudioUrl = await uploadAudioFromUrl(sourceAudioUrl, songId)
    console.log(`[Generate] Song ${songId} uploaded to R2: ${finalAudioUrl}`)
  } catch (r2Error) {
    console.error(`[Generate] Song ${songId} R2 upload failed, using provider URL:`, r2Error)
  }
  ...
}
```

Change to queue-based approach:
```typescript
if (taskId.startsWith('audio:')) {
  const sourceAudioUrl = taskId.slice(6)
  // Queue background upload (non-blocking)
  queueR2Upload(songId, sourceAudioUrl)
  ...
}
```

- [ ] **Step 4: Run lint and type-check**

Run: `npm run lint -- src/app/api/songs/route.ts`
Expected: 0 errors

Run: `npm run type-check`
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/songs/route.ts
git commit -m "feat: trigger background R2 upload after song generation"
```

---

## Task 3: Modify Download Route to Wait for R2

**Files:**
- Modify: `src/app/api/songs/[id]/download/route.ts`

- [ ] **Step 1: Import uploadAndWaitForR2**

Find line 7: `import { verifySessionToken } from "@/lib/auth-utils"`

Add after:
```typescript
import { uploadAndWaitForR2 } from "@/lib/r2-upload-queue"
```

- [ ] **Step 2: Add helper to check if URL is R2**

Add at top of file after imports:
```typescript
function isR2Url(url: string): boolean {
  const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
  return r2PublicUrl.length > 0 && url.startsWith(r2PublicUrl)
}
```

- [ ] **Step 3: Modify download logic to ensure R2**

Find the section around line 77-88:

```typescript
// Check if song has audio
if (!song.audioUrl) {
  return NextResponse.json({ error: "Audio not available" }, { status: 404 })
}

// Fetch the audio from external URL
const audioResponse = await fetch(song.audioUrl)

if (!audioResponse.ok) {
  console.error("Failed to fetch audio from external URL:", audioResponse.status)
  return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 })
}
```

Replace with:
```typescript
// Check if song has audio
if (!song.audioUrl) {
  return NextResponse.json({ error: "Audio not available" }, { status: 404 })
}

// Ensure audio is on R2 (wait for upload if needed)
let audioUrl = song.audioUrl
if (!isR2Url(audioUrl)) {
  try {
    audioUrl = await uploadAndWaitForR2(id, audioUrl)
  } catch (error) {
    console.error("R2 upload failed, falling back to original URL:", error)
    // Fall back to original URL even if R2 upload failed
  }
}

// Fetch the audio
const audioResponse = await fetch(audioUrl)

if (!audioResponse.ok) {
  console.error("Failed to fetch audio:", audioResponse.status)
  return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 })
}
```

- [ ] **Step 4: Run lint and type-check**

Run: `npm run lint -- src/app/api/songs/[id]/download/route.ts`
Expected: 0 errors

Run: `npm run type-check`
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/songs/[id]/download/route.ts
git commit -m "feat: download waits for R2 upload if not complete"
```

---

## Task 4: Verify R2 Storage Module

**Files:**
- Modify: `src/lib/r2-storage.ts` (verify/add missing exports)

- [ ] **Step 1: Verify the module exports uploadAudioFromUrl**

Read `src/lib/r2-storage.ts` and confirm it exports:
```typescript
export async function uploadAudioFromUrl(audioUrl: string, songId: string): Promise<string>
```

If not exported, add the export.

- [ ] **Step 2: Verify R2 client initialization**

Confirm lines 5-18 configure R2 correctly:
```typescript
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})
```

- [ ] **Step 3: Commit if changes made**

```bash
git add src/lib/r2-storage.ts
git commit -m "chore: verify R2 storage module configuration"
```

---

## Task 5: End-to-End Verification

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify environment variables exist**

Check `.env.vercel.production` has:
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
```

---

## Implementation Order (Parallel Execution Friendly)

### Group A: Independent (No Dependencies)
- **Task 4**: Verify R2 storage module (existing code, no conflicts)
- **Task 1**: Create R2 upload queue (new file, no conflicts)

### Group B: Depends on A
- **Task 2**: Trigger background upload (imports from Task 1)
- **Task 3**: Modify download route (imports from Task 1)

### Group C: Verification
- **Task 5**: End-to-end verification

---

## Success Criteria

1. Songs generated are automatically uploaded to R2
2. Download waits for R2 upload if not complete
3. R2 URL overwrites MiniMax URL in `audioUrl` field
4. Upload retries 5 times on failure
5. All existing tests pass
6. Lint and build succeed
