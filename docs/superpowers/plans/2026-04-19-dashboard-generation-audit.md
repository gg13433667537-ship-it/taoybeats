# Dashboard and Generation Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin/dashboard data truthful, remove multipart song generation, stabilize the result card, and align generate-page controls with real MiniMax capability.

**Architecture:** Start with API truth fixes so the UI reads one consistent Prisma-backed model. Then remove multipart generation while preserving the existing MiniMax initiation/polling path, and finally simplify the generate-page control surface so only real or clearly-labeled capabilities remain.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, React Testing Library

---

## File Map

- Modify: `src/app/api/admin/stats/route.ts`
  - Replace in-memory aggregation with Prisma queries for users, songs, and admin logs.
- Modify: `src/app/api/usage/route.ts`
  - Return explicit unlimited flags and successful-song counters.
- Modify: `src/app/(main)/dashboard/page.tsx`
  - Render truthful quota cards and successful-song counters with unlimited wording.
- Add: `tests/api/admin-stats.test.ts`
  - Cover Prisma-backed stats and recent logs.
- Add: `tests/api/usage.test.ts`
  - Cover limited/unlimited quota semantics and successful-song counters.
- Modify: `src/app/api/songs/route.ts`
  - Remove multipart splitting and add long-lyrics compression workflow.
- Modify: `src/app/(main)/generate/page.tsx`
  - Remove multipart UI/polling, handle compression warning, and render the new result card.
- Modify: `src/components/AudioPlayer.tsx`
  - Simplify single-track playback controls and keep download stable.
- Modify: `tests/api/songs.test.ts`
  - Update/create tests for single-pass generation and compression behavior.
- Add: `tests/app/generate-result-card.test.tsx`
  - Cover clean result-card rendering and single-track playback UI.
- Modify: `src/components/AdvancedOptions.tsx`
  - Remove or relabel unsupported controls.
- Modify: `src/components/VoiceSelector.tsx`
  - Clarify indirect influence semantics.
- Modify: `src/components/PersonaSelector.tsx`
  - Clarify indirect influence semantics.
- Modify: `src/lib/ai-providers.ts`
  - Restrict direct request mapping to proven MiniMax music inputs only if current tests show drift.
- Add: `tests/lib/ai-providers-capability-mapping.test.ts`
  - Assert only supported fields are mapped directly to music-generation payloads.

### Task 1: Lock down truthful admin and usage data with tests

**Files:**
- Add: `tests/api/admin-stats.test.ts`
- Add: `tests/api/usage.test.ts`
- Inspect: `src/app/api/admin/stats/route.ts`
- Inspect: `src/app/api/usage/route.ts`

- [ ] **Step 1: Write the failing admin stats test**

```ts
it("reads stats from Prisma instead of in-memory globals", async () => {
  vi.mocked(prisma.user.count)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(2)

  vi.mocked(prisma.song.count)
    .mockResolvedValueOnce(9)
    .mockResolvedValueOnce(6)
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(7)
    .mockResolvedValueOnce(3)

  vi.mocked(prisma.adminLog.findMany).mockResolvedValue([
    { id: "log-1", adminId: "a1", adminEmail: "admin@example.com", action: "UPDATE_USER", createdAt: new Date() },
  ] as any)

  const response = await GET(createAdminRequest())
  const data = await response.json()

  expect(data.songs.total).toBe(9)
  expect(data.songs.successfulToday).toBe(7)
  expect(data.songs.successfulThisMonth).toBe(3)
})
```

- [ ] **Step 2: Run the admin stats test to verify it fails for the current in-memory implementation**

Run: `npm test -- --run tests/api/admin-stats.test.ts`
Expected: FAIL because `/api/admin/stats` does not call Prisma counts for the returned values.

- [ ] **Step 3: Write the failing usage test**

```ts
it("returns explicit unlimited flags and successful song counters", async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user-1",
    role: "ADMIN",
    tier: "PRO",
    dailyUsage: 2,
    monthlyUsage: 8,
    dailyResetAt: "2026-04-19",
    monthlyResetAt: "2026-04",
  } as any)

  vi.mocked(prisma.song.count)
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(11)

  const response = await GET(createUsageRequest(sessionToken))
  const data = await response.json()

  expect(data.daily.unlimited).toBe(true)
  expect(data.monthly.unlimited).toBe(true)
  expect(data.output.successfulToday).toBe(4)
  expect(data.output.successfulThisMonth).toBe(11)
})
```

- [ ] **Step 4: Run the usage test to verify it fails before the API contract change**

Run: `npm test -- --run tests/api/usage.test.ts`
Expected: FAIL because the endpoint currently returns raw `-1` limit semantics and no `output` counters.

- [ ] **Step 5: Commit the red tests**

```bash
git add tests/api/admin-stats.test.ts tests/api/usage.test.ts
git commit -m "test: cover truthful admin stats and usage data"
```

### Task 2: Implement Prisma-backed admin stats and presentation-safe usage data

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`
- Modify: `src/app/api/usage/route.ts`
- Modify: `src/app/(main)/dashboard/page.tsx`
- Test: `tests/api/admin-stats.test.ts`
- Test: `tests/api/usage.test.ts`

- [ ] **Step 1: Replace admin stats aggregation with Prisma queries**

```ts
const [
  totalUsers,
  activeUsers,
  adminUsers,
  proUsers,
  totalSongs,
  pendingSongs,
  generatingSongs,
  completedSongs,
  failedSongs,
  successfulToday,
  successfulThisMonth,
  recentLogs,
] = await Promise.all([
  prisma.user.count(),
  prisma.user.count({ where: { isActive: true } }),
  prisma.user.count({ where: { role: "ADMIN" } }),
  prisma.user.count({ where: { tier: "PRO" } }),
  prisma.song.count(),
  prisma.song.count({ where: { status: "PENDING" } }),
  prisma.song.count({ where: { status: "GENERATING" } }),
  prisma.song.count({ where: { status: "COMPLETED" } }),
  prisma.song.count({ where: { status: "FAILED" } }),
  prisma.song.count({ where: { status: "COMPLETED", createdAt: { gte: startOfToday } } }),
  prisma.song.count({ where: { status: "COMPLETED", createdAt: { gte: startOfMonth } } }),
  prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
])
```

- [ ] **Step 2: Return explicit unlimited flags and output counters from `/api/usage`**

```ts
const isUnlimited = tier === "PRO" || usage.role === "ADMIN"

return NextResponse.json({
  userId,
  tier,
  daily: {
    used: usage.daily,
    limit: isUnlimited ? null : 3,
    remaining: isUnlimited ? null : Math.max(0, 3 - usage.daily),
    unlimited: isUnlimited,
  },
  monthly: {
    used: usage.monthly,
    limit: isUnlimited ? null : 10,
    remaining: isUnlimited ? null : Math.max(0, 10 - usage.monthly),
    unlimited: isUnlimited,
  },
  output: {
    successfulToday,
    successfulThisMonth,
  },
})
```

- [ ] **Step 3: Update dashboard rendering to remove `-1` math and show both quota and output counts**

```tsx
const renderQuotaValue = (bucket: UsageBucket, unlimitedLabel: string) =>
  bucket.unlimited ? unlimitedLabel : `${bucket.remaining ?? 0} / ${bucket.limit ?? 0}`

<p className="text-2xl font-bold text-foreground">
  {usage.daily.unlimited ? "无限生成" : `${usage.daily.remaining} / ${usage.daily.limit}`}
</p>
<p className="text-xs text-text-secondary mt-2">
  今日已生成 {usage.output.successfulToday} 首
</p>
```

- [ ] **Step 4: Run API tests and targeted dashboard test coverage**

Run: `npm test -- --run tests/api/admin-stats.test.ts tests/api/usage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the truthful data implementation**

```bash
git add src/app/api/admin/stats/route.ts src/app/api/usage/route.ts src/app/(main)/dashboard/page.tsx tests/api/admin-stats.test.ts tests/api/usage.test.ts
git commit -m "fix: use truthful prisma-backed dashboard data"
```

### Task 3: Lock down single-pass generation with tests

**Files:**
- Modify: `tests/api/songs.test.ts`
- Add: `tests/app/generate-result-card.test.tsx`
- Inspect: `src/app/api/songs/route.ts`
- Inspect: `src/app/(main)/generate/page.tsx`
- Inspect: `src/components/AudioPlayer.tsx`

- [ ] **Step 1: Add a failing API test proving long lyrics no longer create multipart songs**

```ts
it("creates one song and requests compression instead of multipart generation", async () => {
  const response = await POST(createSongRequest({
    title: "Long Song",
    lyrics: veryLongLyrics,
    genre: ["Pop"],
    mood: "Epic",
  }))

  const data = await response.json()

  expect(data.multiPart).toBeUndefined()
  expect(prisma.song.create).toHaveBeenCalledTimes(1)
  expect(data.compression).toMatchObject({
    applied: true,
    reason: "lyrics_too_long",
  })
})
```

- [ ] **Step 2: Add a failing UI test for the single result card**

```tsx
it("renders a single clean result card without multipart messaging", async () => {
  render(<GeneratePage />)

  expect(screen.queryByText(/Part 1\\//i)).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: /download/i })).toBeVisible()
  expect(screen.getByRole("button", { name: /play/i })).toBeVisible()
})
```

- [ ] **Step 3: Run the generation-focused tests to confirm current multipart behavior is still present**

Run: `npm test -- --run tests/api/songs.test.ts tests/app/generate-result-card.test.tsx`
Expected: FAIL because the server still creates multipart songs and the client still renders multipart UI.

- [ ] **Step 4: Commit the red single-pass tests**

```bash
git add tests/api/songs.test.ts tests/app/generate-result-card.test.tsx
git commit -m "test: cover single-pass generation and result card"
```

### Task 4: Implement single-pass generation and the clean result card

**Files:**
- Modify: `src/app/api/songs/route.ts`
- Modify: `src/app/(main)/generate/page.tsx`
- Modify: `src/components/AudioPlayer.tsx`
- Test: `tests/api/songs.test.ts`
- Test: `tests/app/generate-result-card.test.tsx`

- [ ] **Step 1: Remove multipart splitting and add server-side lyric compression**

```ts
function compressLyricsForSinglePass(lyrics: string): { lyrics: string; applied: boolean } {
  const lines = lyrics.split("\\n").filter(Boolean)
  const targetLineCount = 48
  if (lines.length <= targetLineCount) {
    return { lyrics, applied: false }
  }

  const step = Math.ceil(lines.length / targetLineCount)
  const compressed = lines.filter((_, index) => index % step === 0).join("\\n")
  return { lyrics: compressed, applied: true }
}
```

- [ ] **Step 2: Return compression metadata and create exactly one song row**

```ts
const compression = compressLyricsForSinglePass(sanitizedLyricsInput || "")

const song = await prisma.song.create({
  data: {
    id: songId,
    title: sanitizedTitle,
    lyrics: compression.lyrics || null,
    status: "PENDING",
    userId: user.id,
  },
})

return NextResponse.json({
  id: song.id,
  status: currentStatus,
  compression: {
    applied: compression.applied,
    reason: compression.applied ? "lyrics_too_long" : null,
  },
})
```

- [ ] **Step 3: Strip multipart polling/state from the generate page and show a pre-generation compression warning**

```tsx
if (responseData.compression?.applied) {
  showToast("info", "歌词过长，系统已自动压缩到适合 5 分钟内生成的版本。")
}

setAudioUrl(completedAudioUrl)
setSongId(completedSongId)
setResultMeta({
  status: "COMPLETED",
  format: outputFormat.toUpperCase(),
})
```

- [ ] **Step 4: Simplify `AudioPlayer` to a strong single-track layout**

```tsx
<div className="grid gap-4 rounded-2xl border border-border bg-surface p-4">
  <div className="flex items-center gap-3">
    <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
      {isPlaying ? <Pause /> : <Play />}
    </button>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{currentTitle}</p>
      <p className="text-xs text-text-muted">{currentArtist}</p>
    </div>
    <button onClick={handleDownload} aria-label="Download">
      <Download />
    </button>
  </div>
</div>
```

- [ ] **Step 5: Run the single-pass and result-card tests**

Run: `npm test -- --run tests/api/songs.test.ts tests/app/generate-result-card.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the single-pass generation implementation**

```bash
git add src/app/api/songs/route.ts src/app/(main)/generate/page.tsx src/components/AudioPlayer.tsx tests/api/songs.test.ts tests/app/generate-result-card.test.tsx
git commit -m "fix: make generation single-pass and clean result UI"
```

### Task 5: Audit and clean generate-page capability mapping

**Files:**
- Modify: `src/components/AdvancedOptions.tsx`
- Modify: `src/components/VoiceSelector.tsx`
- Modify: `src/components/PersonaSelector.tsx`
- Modify: `src/lib/ai-providers.ts`
- Add: `tests/lib/ai-providers-capability-mapping.test.ts`

- [ ] **Step 1: Write a failing capability-mapping test**

```ts
it("maps only proven music-generation fields directly into the MiniMax payload", () => {
  const body = buildGenerationRequestBody({
    title: "Song",
    lyrics: "Lyrics",
    genre: ["Pop"],
    mood: "Happy",
    instruments: ["Piano"],
    userNotes: "Bright chorus",
    lyricsOptimizer: true,
    outputFormat: "mp3",
    sampleRate: 44100,
    bitrate: 256000,
    aigcWatermark: false,
    voiceId: "voice-1",
  })

  expect(body).not.toHaveProperty("voice_id")
  expect(body).toHaveProperty("lyrics_optimizer", true)
  expect(body).toHaveProperty("audio_setting")
})
```

- [ ] **Step 2: Run the capability-mapping test to verify the current payload is overclaiming support**

Run: `npm test -- --run tests/lib/ai-providers-capability-mapping.test.ts`
Expected: FAIL because the current provider payload still includes unsupported direct fields such as `voice_id`.

- [ ] **Step 3: Remove unsupported direct mappings and relabel indirect controls in the UI**

```ts
return {
  ...commonBody,
  lyrics: isInstrumental ? undefined : params.lyrics,
  is_instrumental: isInstrumental,
  lyrics_optimizer: params.lyricsOptimizer,
}
```

```tsx
<p className="text-xs text-text-muted">
  音色和人设当前通过提示词或参考音频间接影响歌曲效果，不保证精确绑定歌声音色。
</p>
```

- [ ] **Step 4: Run the capability-mapping and relevant component tests**

Run: `npm test -- --run tests/lib/ai-providers-capability-mapping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the capability audit cleanup**

```bash
git add src/components/AdvancedOptions.tsx src/components/VoiceSelector.tsx src/components/PersonaSelector.tsx src/lib/ai-providers.ts tests/lib/ai-providers-capability-mapping.test.ts
git commit -m "fix: align generate controls with real minimax capabilities"
```

### Task 6: Full verification

**Files:**
- Verify: `tests/api/admin-stats.test.ts`
- Verify: `tests/api/usage.test.ts`
- Verify: `tests/api/songs.test.ts`
- Verify: `tests/app/generate-result-card.test.tsx`
- Verify: `tests/lib/ai-providers-capability-mapping.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run: `npm test -- --run tests/api/admin-stats.test.ts tests/api/usage.test.ts tests/api/songs.test.ts tests/app/generate-result-card.test.tsx tests/lib/ai-providers-capability-mapping.test.ts`
Expected: PASS

- [ ] **Step 2: Run type-check**

Run: `npm run type-check`
Expected: no TypeScript errors

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit the verification sweep**

```bash
git add .
git commit -m "chore: verify dashboard and generation audit changes"
```
