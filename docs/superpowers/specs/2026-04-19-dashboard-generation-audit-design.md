# Dashboard, Generation, and Capability Audit Design

**Date:** 2026-04-19

## Goal

Stabilize the admin/dashboard data model and the MiniMax song generation experience without breaking the currently working generation path.

This work has three subprojects executed in order:

1. Admin and user dashboard data integrity
2. Single-pass song generation and result-card stabilization
3. Full audit of generate-page parameters against real MiniMax capabilities

## Confirmed Product Decisions

- Admin changes only need to appear correctly after the target user refreshes the dashboard.
- Dashboard usage cards must show both quota information and real output counts.
- Unlimited users must see explicit wording:
  - `今日：无限生成`
  - `本月：无限生成`
  - plus separate counters:
    - `今日已生成 X 首`
    - `本月已生成 Y 首`
- Real song counts only include successfully generated songs (`COMPLETED`).
- Song generation must not split into multiple parts.
- A single generation should produce one complete song.
- The target song length must not exceed 5 minutes.
- If lyrics are too long, the system may compress them automatically, but must clearly tell the user before generation continues.
- The completed result area on the generate page should be a full result card with title, status/format/duration metadata, a clean player, and working download/share actions.
- Core generation controls must truly affect generation or be removed.
- Peripheral advanced features may remain only if clearly labeled when they do not directly affect song generation.
- Voice cloning / persona / voice controls may influence generation indirectly through reference-audio-based flows, but must not be presented as guaranteed direct song-voice control unless the API contract clearly supports it.

## Current Problems

### 1. Admin and dashboard data are inconsistent

- `src/app/api/admin/stats/route.ts` still reads users/songs/logs from in-memory globals instead of Prisma.
- `src/app/api/usage/route.ts` encodes unlimited usage with `-1`, and the dashboard renders that raw model directly, producing confusing values like `0 / -1` and bare symbols.
- The dashboard currently shows total song list length, not the requested successful-output counts split by today/month.

### 2. Generate flow still contains multipart behavior

- `src/app/api/songs/route.ts` splits long lyrics into multiple song rows with `partGroupId` and `part`.
- `src/app/(main)/generate/page.tsx` contains multipart polling, playlist playback, and multipart messaging.
- `src/components/AudioPlayer.tsx` supports playlist/track navigation that was added mainly to compensate for multipart output.

### 3. Generate-page controls exceed proven MiniMax music capability

- The current page sends many fields that the public music-generation API contract does not clearly expose as effective inputs.
- The real public music-generation contract is centered around `prompt`, `lyrics`, `lyrics_optimizer`, `is_instrumental`, output/audio settings, and cover/reference-audio style inputs.
- Voice cloning and voice design APIs clearly return `voice_id` values for voice/speech products, but the public music-generation reference does not clearly guarantee direct `voice_id` support for song generation.

Official references used for this design:

- https://platform.minimaxi.com/docs/api-reference/music-generation
- https://platform.minimaxi.com/docs/api-reference/lyrics-generation
- https://platform.minimaxi.com/docs/api-reference/voice-cloning-clone
- https://platform.minimaxi.com/docs/api-reference/voice-design-design
- https://platform.minimaxi.com/docs/api-reference/voice-management-get

## Design

### Subproject 1: Data Integrity

#### Admin stats source of truth

- Replace in-memory admin stats aggregation with Prisma-backed queries.
- Admin stats should report:
  - total users
  - active users
  - admin users
  - pro-tier users
  - total songs
  - songs by status
  - successful songs generated today
  - successful songs generated this month
  - recent admin logs from Prisma
- User-list edits already write to Prisma. The missing fix is to make every dependent read path use the same source of truth.

#### User dashboard usage model

- Keep `/api/usage` as the quota endpoint, but change its response shape to be presentation-safe.
- Replace raw `-1` semantics with an explicit unlimited flag:
  - `daily.unlimited`
  - `monthly.unlimited`
- Return both quota data and successful-output counters:
  - quota:
    - used
    - limit
    - remaining
    - unlimited
  - real output:
    - successfulToday
    - successfulThisMonth
- Dashboard UI should render:
  - limited users: remaining / limit plus progress bar
  - unlimited users: `无限生成` text and no misleading denominator/progress math
  - both user types: separate successful song counts for today and this month

### Subproject 2: Single-Pass Generation

#### Long-lyrics policy

- Remove all multipart creation logic from song creation.
- Before creating the song record, estimate whether the lyrics would exceed the 5-minute target.
- If the lyrics are too long:
  - generate a compressed lyrics variant locally on the server
  - return a response that tells the client compression is required
  - show the user the warning before the actual generation begins
  - proceed using the compressed lyrics only after the warning is surfaced in the UI flow
- The user-facing message must explain:
  - the original lyrics were too long for one full song
  - the system compressed them to keep output within the target duration
  - the current generation will use the compressed version

#### Result-card architecture

- Remove multipart playlist semantics from the generate page result area.
- The result card should display one song result with:
  - title
  - status badge
  - output format
  - duration when metadata is available
  - clean audio player
  - download button
  - share button
- The player must prioritize stable single-track playback over extra controls.
- Download should continue to use the API proxy route so browser CORS does not break local downloads.

#### Stability constraint

- Preserve the current working MiniMax initiation/polling path.
- Avoid large provider rewrites unless required by tests.
- Do not change successful completion storage format (`audioUrl`) unless verification shows a real bug.

### Subproject 3: Capability Audit and Parameter Cleanup

#### Capability tiers

- Split generate-page controls into three categories:

1. Directly effective for public MiniMax music generation
2. Indirectly effective through prompt/reference-audio workflows
3. Not proven effective and must be labeled or removed

#### Direct controls

- Keep only if wired end-to-end and supported by the public contract:
  - title
  - lyrics
  - genre/mood/instruments as prompt-building inputs
  - user notes as prompt-building input
  - instrumental toggle
  - lyrics optimizer
  - model choice that is actually supported
  - output format
  - sample rate / bitrate / watermark if accepted by the request contract
  - reference audio for cover/reference-driven generation

#### Indirect controls

- Voice/persona controls may remain only if converted into explicit indirect behavior, such as:
  - selecting reference audio or a cloned/design voice sample that is transformed into a usable reference-audio input
  - prebuilding prompt hints that describe vocal style rather than claiming direct voice binding
- UI copy must clearly say these controls influence style or reference behavior, not guaranteed exact vocal identity.

#### Unsupported or weakly supported controls

- Any field that is collected but not truly used must be either:
  - removed from the generate page if it is presented as a core generation lever
  - relabeled as experimental / indirect / not directly applied to song generation if it is peripheral

## Data Flow

### Dashboard

1. Admin updates user tier/usage in Prisma.
2. User refreshes dashboard.
3. Dashboard fetches:
   - `/api/usage`
   - `/api/songs`
4. `/api/usage` reads Prisma user record plus successful song counts from Prisma.
5. Dashboard renders quota and successful-output counts using explicit unlimited semantics.

### Generate flow

1. User fills generate form.
2. Client submits generation request intent.
3. Server validates fields and checks lyric-length budget.
4. If compression is needed, server returns a compression-required payload.
5. Client shows warning and continues generation with the compressed lyrics path.
6. Server creates one song row.
7. Server initiates one MiniMax generation task.
8. Client polls/SSE-refreshes one song status until completion.
9. Result card renders one playable/downloadable song.

## Error Handling

- Admin/dashboard endpoints should fail closed with clear API errors, not silently fall back to stale in-memory values.
- Unlimited quota rendering must never rely on divide-by-negative-one math.
- Long-lyrics compression failures should abort generation with a clear actionable message rather than silently truncating unpredictably.
- If duration metadata cannot be read, the result card should omit duration rather than show nonsense placeholders.
- If an indirect voice/persona control cannot be applied for a given generation mode, the UI must say so before submission or in contextual helper text.

## Testing Strategy

### Data integrity

- API tests for `/api/admin/stats` using Prisma-backed fixtures.
- API tests for `/api/usage` covering:
  - free user
  - pro/admin unlimited user
  - successful song counts today/month
- UI test for dashboard rendering of unlimited wording and successful-output counts.

### Generation

- API tests proving long lyrics no longer create multipart rows.
- API tests for compression-required response and compressed single-song creation.
- UI tests for generate-page result-card rendering after completion.
- Regression tests for single-track playback/download behavior.

### Capability audit

- Unit tests for prompt/request building to ensure only supported fields are mapped directly.
- UI/component tests for labeling/removing unsupported controls.

## Rollout Notes

- Implement subprojects in order so data truth is fixed before generation UI metrics depend on it.
- Keep existing working MiniMax generation logic as intact as possible while stripping multipart behavior.
- Prefer additive API response changes that the UI can adopt without breaking existing callers.
