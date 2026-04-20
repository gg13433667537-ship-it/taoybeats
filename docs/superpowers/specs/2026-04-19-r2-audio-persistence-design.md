# R2 Audio Persistence — Design Document

## Overview

**Goal**: Make generated songs permanently available by uploading MiniMax audio files to Cloudflare R2 storage on completion.

**Problem**: MiniMax audio URLs expire after 24 hours. Generated songs become unplayable/un-downloadable after this window.

**Solution**: After MiniMax generates an audio file, asynchronously upload it to Cloudflare R2. Ensure upload succeeds via retry mechanism. Update `audioUrl` field to point to R2 URL permanently.

---

## Architecture

### Data Flow

```
MiniMax API generates audio
        ↓
Audio URL returned (expires in 24h)
        ↓
Song record saved with MiniMax URL
        ↓
[ASYNC] Background upload to R2 triggered
        ↓
R2 upload succeeds (with 5 retries)
        ↓
audioUrl updated to R2 URL (permanent)
```

### Download Flow

```
User clicks download
        ↓
Check if R2 upload complete (audioUrl points to R2?)
        ↓
┌─ YES: Stream from R2 directly
└─ NO: Wait for R2 upload, then stream
        ↓
File downloaded to user
```

---

## Implementation Details

### 1. R2 Storage Module (`src/lib/r2-storage.ts`)

**Existing file - verify and enhance if needed**

Functions needed:
- `uploadAudioFromUrl(audioUrl: string, songId: string): Promise<string>`
  - Downloads audio from source URL
  - Uploads to R2 with key `songs/{songId}.{ext}`
  - Returns R2 public URL

### 2. Background Upload Queue (`src/lib/r2-upload-queue.ts`)

**New file - retry-aware background processor**

```typescript
interface QueuedUpload {
  songId: string
  audioUrl: string
  attempts: number
  createdAt: Date
}

// Singleton queue
const uploadQueue: QueuedUpload[] = []
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 2000 // 2 seconds

async function processQueue() {
  // Process all queued uploads
  // For each: call r2.uploadAudioFromUrl, on success remove from queue and update DB
  // On failure: retry up to 5 times with delay
}
```

### 3. Song Generation Route (`src/app/api/songs/route.ts`)

**Modify existing file**

After song generation completes:
1. Save song with MiniMax URL
2. Add to R2 upload queue (async, non-blocking)
3. Return response to user immediately

```typescript
// After song.audioUrl is set
if (song.audioUrl) {
  // Non-blocking queue add
  addToR2UploadQueue(song.id, song.audioUrl)
}
```

### 4. Download Route (`src/app/api/songs/[id]/download/route.ts`)

**Modify existing file**

Check and wait for R2 upload if needed:

```typescript
async function ensureR2Uploaded(songId: string, audioUrl: string): Promise<string> {
  // If audioUrl already points to R2, return immediately
  if (isR2Url(audioUrl)) return audioUrl

  // Otherwise, this is a MiniMax URL - trigger immediate upload and wait
  return await uploadAndWait(songId, audioUrl)
}
```

### 5. Database Schema

**No changes needed**

Use existing `audioUrl` field. After R2 upload:
- Update `audioUrl` from MiniMax URL → R2 URL
- R2 URL format: `{R2_PUBLIC_URL}/songs/{songId}.{ext}`

### 6. R2 Configuration

**Verify environment variables exist:**
```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

---

## File Changes

### New Files
- `src/lib/r2-upload-queue.ts` — Background upload queue with retry

### Modified Files
- `src/lib/r2-storage.ts` — Verify existing implementation
- `src/app/api/songs/route.ts` — Trigger background upload after generation
- `src/app/api/songs/[id]/download/route.ts` — Wait for R2 if needed

### No Changes
- `prisma/schema.prisma` — No schema change needed
- `src/lib/types.ts` — No type change needed

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| R2 upload fails | Retry 5 times with 2s delay between attempts |
| All retries exhausted | Log error, song stays with MiniMax URL (download will fail after 24h) |
| MiniMax URL already expired | Download fails with clear error message |
| R2 not configured | Log warning, fall back to current behavior |

---

## Testing Strategy

1. **Unit tests** for `r2-storage.ts` and `r2-upload-queue.ts`
2. **Integration test** for full upload flow (mock R2)
3. **E2E test** for download flow

---

## Rollout Order (Parallel Execution Friendly)

### Phase 1: Infrastructure (Independent)
- `src/lib/r2-upload-queue.ts` — New file, no conflicts

### Phase 2: Integration (Depends on Phase 1)
- Modify `songs/route.ts` to trigger uploads
- Modify `download/route.ts` for R2-first download

### Phase 3: Verification
- Run tests
- Verify R2 environment variables configured

---

## Success Criteria

1. Songs generated >24h ago remain downloadable
2. Download never fails with "Song not found" or "Audio not available"
3. R2 uploads succeed within 5 retry attempts under normal network conditions
4. No breaking changes to existing functionality
