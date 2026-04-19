# Generation, Dashboard, and Playlist Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the generate page, dashboard song actions, and playlists page all behave reliably and coherently without breaking the existing MiniMax song generation backend flow.

**Architecture:** Fix the shared reliability seams first, then repair each UI surface with focused changes. Reuse the existing App Router APIs, add one small shared client download helper, and introduce one playlist drawer component so the UI work stays isolated instead of expanding the existing page files further.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Vitest, Playwright, Tailwind CSS

---

### Task 1: Pin the generate-page regressions with focused tests

**Files:**
- Modify: `tests/app/generate-result-card.test.tsx`

- [ ] **Step 1: Extend the generate-page test so the progress area has to change as SSE events change**

Update the mocked progress component so the test can inspect real props:
```tsx
vi.mock("@/components/GenerationProgress", () => ({
  default: ({ stage, progress, stageMessage }: { stage: string; progress: number; stageMessage?: string }) => (
    <div data-testid="generation-progress">{`${stage}|${progress}|${stageMessage ?? ""}`}</div>
  ),
}))
```
Then emit at least:
```ts
MockEventSource.instances[0].emitMessage({ status: "PENDING", progress: 10, stage: "Queued..." })
MockEventSource.instances[0].emitMessage({ status: "GENERATING", progress: 52, stage: "Creating your music..." })
MockEventSource.instances[0].emitMessage({ status: "COMPLETED", progress: 100, stage: "Complete!", audioUrl: "https://cdn.example.com/song-1.mp3", songId: "song-1" })
```
and assert the rendered progress text changes instead of staying on `initializing`.

- [ ] **Step 2: Make the same test fail on the missing duration bug**

Change the mocked audio player so it can push a resolved duration back into the page:
```tsx
vi.mock("@/components/AudioPlayer", async () => {
  const React = await import("react")
  return {
    default: ({ src, onDurationResolved }: { src?: string; onDurationResolved?: (seconds: number) => void }) => {
      React.useEffect(() => {
        if (src) onDurationResolved?.(187)
      }, [src, onDurationResolved])
      return <div data-testid="audio-player">{src || "no-audio"}</div>
    },
  }
})
```
Add an assertion that the result card shows `3:07` and no longer shows the placeholder text.

- [ ] **Step 3: Run the generate-page regression test and verify it fails for the intended reasons**

Run: `npm test -- --run tests/app/generate-result-card.test.tsx`
Expected: FAIL because the current page still never updates the duration label. The new progress assertions may already pass in this branch; if so, they remain as regression coverage and the red failure should still cleanly capture the missing duration handoff in the same test.

- [ ] **Step 4: Commit the red test if it cleanly captures the regressions**

```bash
git add tests/app/generate-result-card.test.tsx
git commit -m "test: pin generate page progress and duration regressions"
```

### Task 2: Implement the generate-page reliability and layout fixes

**Files:**
- Modify: `src/app/(main)/generate/page.tsx`
- Modify: `src/components/GenerationProgress.tsx`
- Modify: `src/components/AudioPlayer.tsx`
- Modify: `src/lib/i18n.tsx`
- Verify: `npm test -- --run tests/app/generate-result-card.test.tsx`

- [ ] **Step 1: Add a single presentation-layer status mapper in the generate page**

Keep the backend truth values untouched, but map them to richer UI copy:
```ts
function mapGenerationPresentation(status: "PENDING" | "GENERATING" | "COMPLETED" | "FAILED", progress: number, stage?: string) {
  if (status === "PENDING") return { stage: "initializing", progress: Math.max(progress, 8), message: "Queued. Preparing your song..." }
  if (status === "GENERATING") return { stage: "generating", progress: Math.max(progress, 35), message: stage || "Generating the full song..." }
  if (status === "COMPLETED") return { stage: "completed", progress: 100, message: "Song ready" }
  return { stage: "failed", progress: 0, message: "Generation failed" }
}
```
Use this in both SSE updates and the polling fallback so the UI never freezes on `Initializing...`.

- [ ] **Step 2: Wire duration into the result card instead of leaving it permanently null**

Add a duration callback prop to the player:
```tsx
<AudioPlayer
  src={audioUrl || undefined}
  songId={songId || undefined}
  title={title}
  onDurationResolved={(seconds) => setResultDurationLabel(formatDuration(seconds))}
/>
```
Initialize the card to a neutral fallback like `--:--` until the callback fires.

- [ ] **Step 3: Restructure the result card and contain the player controls**

Rebuild the completed-state section into three blocks:
```tsx
<section className="rounded-[28px] border border-border bg-surface p-6 shadow-[...]">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">...</div>
  <div className="mt-5 rounded-2xl bg-background/70 p-4">...</div>
  <div className="mt-5 flex flex-col gap-3 sm:flex-row">...</div>
</section>
```
In `src/components/AudioPlayer.tsx`, move the volume controls into a wrapping row and constrain them with `min-w-0`, `flex-wrap`, and width classes that do not overflow the parent.

- [ ] **Step 4: Make `GenerationProgress` visually active while still truthful**

Keep the current component API, but update the internals so the waiting states show:
```tsx
<div className="rounded-3xl border border-accent/20 bg-[radial-gradient(...)] p-6">
```
Use stage-specific headings and calmer copy for:
```ts
"queued" -> "Task created. Waiting for generation slot..."
"generating" -> "Building melody, vocals, and arrangement..."
"finalizing" -> "Finalizing a playable file..."
```
Do not show `completed` until the backend actually returns completion.

- [ ] **Step 5: Re-run the generate-page regression test and verify it turns green**

Run: `npm test -- --run tests/app/generate-result-card.test.tsx`
Expected: PASS with assertions covering changing progress text, single clean result card behavior, and real duration output.

- [ ] **Step 6: Commit the generate-page fix**

```bash
git add src/app/\(main\)/generate/page.tsx src/components/GenerationProgress.tsx src/components/AudioPlayer.tsx src/lib/i18n.tsx tests/app/generate-result-card.test.tsx
git commit -m "fix: stabilize generate page progress and result card"
```

### Task 3: Add shared download and dashboard action regression coverage

**Files:**
- Create: `tests/lib/song-download.test.ts`
- Create: `tests/app/dashboard-song-actions.test.tsx`

- [ ] **Step 1: Add a failing test for a shared client download helper**

Create `tests/lib/song-download.test.ts` with cases like:
```ts
it("throws on non-ok responses instead of saving the error payload", async () => {
  global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }))
  await expect(downloadSongFile({ songId: "song-1", fallbackFilename: "song.mp3" })).rejects.toThrow("Internal server error")
})
```
and:
```ts
it("downloads a blob only when the proxy response is ok", async () => {
  global.fetch = vi.fn().mockResolvedValue(new Response(new Blob(["audio"]), { status: 200, headers: { "Content-Type": "audio/mpeg" } }))
})
```

- [ ] **Step 2: Add a failing dashboard component test for download and delete feedback**

Create `tests/app/dashboard-song-actions.test.tsx` with a mocked song list and assertions like:
```tsx
expect(screen.getByRole("button", { name: /download song/i })).toBeEnabled()
fireEvent.click(screen.getByRole("button", { name: /download song/i }))
await waitFor(() => expect(mockToast.showToast).toHaveBeenCalledWith("error", expect.stringContaining("Download")))
```
and:
```tsx
fireEvent.click(screen.getByRole("button", { name: /delete song/i }))
await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/songs/song-1", expect.objectContaining({ method: "DELETE" })))
```

- [ ] **Step 3: Run the new shared download and dashboard tests and verify they fail**

Run: `npm test -- --run tests/lib/song-download.test.ts tests/app/dashboard-song-actions.test.tsx`
Expected: FAIL because there is no shared client helper yet and the dashboard still treats failed downloads and deletes too loosely.

- [ ] **Step 4: Commit the regression tests**

```bash
git add tests/lib/song-download.test.ts tests/app/dashboard-song-actions.test.tsx
git commit -m "test: pin dashboard download and delete regressions"
```

### Task 4: Implement shared download reliability and dashboard action fixes

**Files:**
- Create: `src/lib/song-download.ts`
- Modify: `src/app/(main)/dashboard/page.tsx`
- Modify: `src/app/(main)/generate/page.tsx`
- Modify: `src/app/song/[id]/page.tsx`
- Modify: `src/components/AudioPlayer.tsx`
- Modify: `src/app/api/songs/[id]/download/route.ts`
- Verify: `npm test -- --run tests/lib/song-download.test.ts tests/app/dashboard-song-actions.test.tsx tests/api/song-download.test.ts`

- [ ] **Step 1: Implement the shared client helper and reuse it everywhere a song file is downloaded**

Create `src/lib/song-download.ts`:
```ts
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
  // createObjectURL + anchor click
}
```
Switch the generate page, dashboard, song detail page, and `AudioPlayer` to call this helper instead of duplicating fetch/blob logic.

- [ ] **Step 2: Tighten the download API error shape so the frontend can show useful messages**

In `src/app/api/songs/[id]/download/route.ts`, keep the current auth rules but preserve meaningful JSON errors:
```ts
return NextResponse.json({ error: "Audio not available" }, { status: 404 })
return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 })
```
Do not return a blob unless the upstream fetch succeeded.

- [ ] **Step 3: Make the dashboard action buttons reflect real song state and request state**

In `src/app/(main)/dashboard/page.tsx`:
```ts
const isPlayable = primarySong.status === "COMPLETED"
const songHref = `/song/${primarySong.id}`
```
Add per-song loading state for delete/download, disable impossible actions, and show success/error toasts for:
```ts
showToast("success", "Song deleted")
showToast("error", error.message)
```
Do not trigger file save on a failed download response.

- [ ] **Step 4: Re-run the shared download, dashboard, and API tests**

Run: `npm test -- --run tests/lib/song-download.test.ts tests/app/dashboard-song-actions.test.tsx tests/api/song-download.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the shared reliability layer**

```bash
git add src/lib/song-download.ts src/app/\(main\)/dashboard/page.tsx src/app/\(main\)/generate/page.tsx src/app/song/\[id\]/page.tsx src/components/AudioPlayer.tsx src/app/api/songs/\[id\]/download/route.ts tests/lib/song-download.test.ts tests/app/dashboard-song-actions.test.tsx tests/api/song-download.test.ts
git commit -m "fix: harden song downloads and dashboard actions"
```

### Task 5: Pin playlist drawer and playlist-song data regressions

**Files:**
- Create: `tests/api/playlist-songs.test.ts`
- Create: `tests/app/playlists-drawer.test.tsx`

- [ ] **Step 1: Add a failing API test for playlist song detail loading**

Create `tests/api/playlist-songs.test.ts` with coverage for:
```ts
it("returns detailed playlist songs from Prisma when song ids are not present in global cache", async () => {
  global.playlists?.set("playlist-1", { id: "playlist-1", userId: "user-1", songIds: ["song-1"], name: "Night Mix", isPublic: false, createdAt: "...", updatedAt: "..." })
  vi.mocked(prisma.song.findMany).mockResolvedValue([{ id: "song-1", title: "Night Drive", status: "COMPLETED", audioUrl: "https://cdn.example.com/night.mp3", userId: "user-1", genre: ["Synthwave"], instruments: [], createdAt: new Date(), updatedAt: new Date() }] as any)
})
```
and a POST case proving a DB-backed song can still be added to the playlist after a refresh.

- [ ] **Step 2: Add a failing playlist page test for the in-page drawer**

Create `tests/app/playlists-drawer.test.tsx` that renders the playlists page with mocked fetch responses, clicks a playlist card, and expects:
```tsx
expect(screen.getByRole("dialog", { name: /night mix/i })).toBeVisible()
expect(screen.getByText("Night Drive")).toBeVisible()
expect(pushMock).not.toHaveBeenCalled()
```

- [ ] **Step 3: Run the playlist API and UI tests and verify they fail**

Run: `npm test -- --run tests/api/playlist-songs.test.ts tests/app/playlists-drawer.test.tsx`
Expected: FAIL because there is no playlist song-detail GET path and no drawer UI yet.

- [ ] **Step 4: Commit the red playlist tests**

```bash
git add tests/api/playlist-songs.test.ts tests/app/playlists-drawer.test.tsx
git commit -m "test: pin playlist drawer regressions"
```

### Task 6: Implement the playlist drawer and final verification pass

**Files:**
- Create: `src/components/PlaylistDrawer.tsx`
- Modify: `src/app/(main)/playlists/page.tsx`
- Modify: `src/app/api/playlists/[id]/songs/route.ts`
- Modify: `src/lib/i18n.tsx`
- Verify: `npm test -- --run tests/api/playlist-songs.test.ts tests/app/playlists-drawer.test.tsx`
- Verify: `npm run type-check`
- Verify: `npm run build`

- [ ] **Step 1: Add a GET handler to `src/app/api/playlists/[id]/songs/route.ts`**

Use the existing playlist ownership rules, then resolve songs from cache plus Prisma:
```ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const playlist = ...
  const cachedSongs = playlist.songIds.map((songId) => global.songs?.get(songId)).filter(Boolean)
  const missingIds = playlist.songIds.filter((songId) => !cachedSongs.some((song) => song.id === songId))
  const dbSongs = missingIds.length ? await prisma.song.findMany({ where: { id: { in: missingIds } } }) : []
  return applySecurityHeaders(NextResponse.json({ songs: [...cachedSongs, ...normalizedDbSongs] }))
}
```
Also change the POST path to fall back to `prisma.song.findUnique` before rejecting a valid persisted song as missing.

- [ ] **Step 2: Extract the drawer UI into a dedicated component**

Create `src/components/PlaylistDrawer.tsx` with a focused interface:
```tsx
export default function PlaylistDrawer({
  isOpen,
  playlist,
  songs,
  loading,
  onClose,
  onRemoveSong,
  onOpenSong,
  onDownloadSong,
}: PlaylistDrawerProps) { ... }
```
Render it as a real dialog with backdrop, slide-in panel, empty state, and per-song status/action rows.

- [ ] **Step 3: Wire the playlists page to open the drawer without navigation**

In `src/app/(main)/playlists/page.tsx`, add state like:
```ts
const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
const [drawerSongs, setDrawerSongs] = useState<PlaylistSong[]>([])
const [drawerLoading, setDrawerLoading] = useState(false)
```
Open the drawer on card click, fetch `/api/playlists/${playlist.id}/songs`, and render the new component. Keep edit/delete buttons working without opening the drawer when those buttons are clicked.

- [ ] **Step 4: Re-run playlist tests, then run the full verification commands**

Run: `npm test -- --run tests/api/playlist-songs.test.ts tests/app/playlists-drawer.test.tsx`
Expected: PASS.

Run: `npm test -- --run tests/app/generate-result-card.test.tsx tests/lib/song-download.test.ts tests/app/dashboard-song-actions.test.tsx tests/api/song-download.test.ts tests/api/song-status-refresh.test.ts`
Expected: PASS.

Run: `npm run type-check`
Expected: no TypeScript errors.

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 5: Commit the playlist and final verification changes**

```bash
git add src/components/PlaylistDrawer.tsx src/app/\(main\)/playlists/page.tsx src/app/api/playlists/\[id\]/songs/route.ts src/lib/i18n.tsx tests/api/playlist-songs.test.ts tests/app/playlists-drawer.test.tsx
git commit -m "feat: add in-page playlist drawer"
```
