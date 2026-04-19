# Music Generation Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the MiniMax music generation flow so browser-triggered generations can complete, then be played and downloaded successfully.

**Architecture:** Fix the provider layer first because all create/regenerate/continue flows share it. Use the existing failing provider tests as the first guardrail, then verify that generated `audioUrl` values can travel through the API routes into playback and download endpoints without being lost.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, MiniMax Music API

---

### Task 1: Reproduce and pin down provider regressions

**Files:**
- Modify: `tests/lib/ai-providers.test.ts`
- Modify: `src/lib/ai-providers.ts`
- Verify: `npm test -- --run tests/lib/ai-providers.test.ts`

- [ ] **Step 1: Confirm the current provider tests fail for the known regression**

Run: `npm test -- --run tests/lib/ai-providers.test.ts`
Expected: failures around nested `data.status`/`data.audio`, cover request payload fields, and continuation support.

- [ ] **Step 2: Add or refine the failing test coverage if a real MiniMax response shape is still untested**

Focus on:
```ts
{
  data: {
    status: 1 | 2,
    task_id?: 'task-123',
    audio?: 'https://.../song.mp3',
  },
  base_resp: {
    status_code: 0,
    status_msg: 'success',
  },
}
```

- [ ] **Step 3: Re-run the provider tests and verify they stay red for the intended reason**

Run: `npm test -- --run tests/lib/ai-providers.test.ts`
Expected: assertions fail because provider parsing/request formatting is wrong, not because of test setup issues.

### Task 2: Fix the shared MiniMax provider

**Files:**
- Modify: `src/lib/ai-providers.ts`
- Verify: `npm test -- --run tests/lib/ai-providers.test.ts`

- [ ] **Step 1: Fix the polling response parser**

Implement support for MiniMax responses where generation info is nested under `data` and `status` may be numeric:
```ts
const payload = data.data ?? data
```
Map `1` to an in-progress state and `2` to `COMPLETED`, while preserving `audio`, `audio_url`, and `video_url`.

- [ ] **Step 2: Fix request payload construction for cover/continuation flows**

Ensure:
```ts
model === 'music-cover' -> body.audio_url = params.referenceAudio
```
and expose a `continue()` helper that also sends `audio_url` instead of `reference_audio`.

- [ ] **Step 3: Keep API-level error handling intact**

Continue honoring `base_resp.status_code` errors for both create and poll endpoints so bad MiniMax responses surface as actionable failures.

- [ ] **Step 4: Re-run provider tests and verify green**

Run: `npm test -- --run tests/lib/ai-providers.test.ts`
Expected: all provider tests pass.

### Task 3: Verify app-level generation, playback, and download paths

**Files:**
- Inspect: `src/app/api/songs/route.ts`
- Inspect: `src/app/api/songs/[id]/download/route.ts`
- Verify: `npm run type-check`
- Verify: `npm run build`

- [ ] **Step 1: Confirm the fixed provider output matches what songs routes expect**

Check that completed generations set:
```ts
{
  status: 'COMPLETED',
  audioUrl: 'https://...'
}
```
so SSE, playback, and download routes can consume the same URL.

- [ ] **Step 2: Run type-check and build**

Run: `npm run type-check`
Expected: no TypeScript errors.

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 3: If generation still fails in browser, instrument the next failing boundary**

Only if needed, add targeted logs around:
```ts
musicProvider.generate(...)
musicProvider.getProgress(...)
updateSongStatus(...)
```
to isolate whether the remaining issue is provider parsing or background execution.
