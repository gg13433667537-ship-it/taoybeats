# Generation, Dashboard, and Playlist Reliability Design

**Date:** 2026-04-19

## Goal

Fix the three connected user-facing failures without breaking the currently working MiniMax generation path:

1. The generate page should show meaningful progress, a polished result card, a real duration, and working playback/download actions.
2. The dashboard should open, download, and delete songs reliably instead of showing broken detail pages or downloading error JSON.
3. The playlists page should stay on the current page and open a high-quality drawer that lets the user browse and act on songs inside a playlist.

This design intentionally favors low-risk targeted fixes over architectural rewrites.

## Confirmed Product Decisions

- All three problem areas are in scope for the same delivery:
  - generate page
  - dashboard song flows
  - playlist experience
- The generation backend flow must not be rewritten if avoidable.
- The UI may use stage animation, estimated progress movement, and richer waiting copy as long as it does not fake final completion.
- Playlist interaction should not navigate to a new page.
- Clicking a playlist should open an in-page drawer or sliding panel that shows the playlist songs.
- The playlist drawer should feel visually refined, not like a plain modal.
- Long lyrics may be compressed automatically when needed to keep output within the single-song time budget, but the user must be told clearly before generation starts.

## Current Problems

### 1. Generate page progress and result card are misleading

- `src/app/(main)/generate/page.tsx` initializes progress state but the user-facing stage can remain stuck on `Initializing...` for most of the task.
- The SSE route `src/app/api/songs/[id]/stream/route.ts` only exposes coarse states (`PENDING`, `GENERATING`, `COMPLETED`, `FAILED`) and currently maps them to generic messages.
- The generate page keeps a `resultDurationLabel` state that is never updated, so duration falls back to placeholder text.
- The generate page and `src/components/AudioPlayer.tsx` have overlapping or cramped layout behavior in the result area, especially around volume and action controls.
- Generate-page download is routed through `/api/songs/[id]/download`, but the user-facing feedback is too coarse and does not distinguish temporary unavailability from real failure.

### 2. Dashboard song actions are inconsistent

- The dashboard can list songs returned by `/api/songs`, but some follow-up actions do not handle downstream failures correctly.
- Dashboard download currently saves the response body without first checking `response.ok`, which can turn backend JSON errors into downloaded files.
- Dashboard delete currently lacks a strong feedback loop, making failures look like no-op clicks.
- The song-detail route must be treated as the canonical owner view for dashboard items so the same song object can be listed, opened, played, and downloaded consistently after refresh.

### 3. Playlist UX is incomplete

- `src/app/(main)/playlists/page.tsx` currently renders playlist cards with edit/delete controls only.
- There is no in-page detail viewer for the songs inside a playlist.
- Users can create playlists and add songs, but cannot comfortably inspect or play them where they are managing the playlist.

## Design

### Subproject 1: Generate Page Stabilization

#### Progress model

- Keep the backend truth model as:
  - `PENDING`
  - `GENERATING`
  - `COMPLETED`
  - `FAILED`
- Add a client-side presentation layer that maps those states into user-friendly phases:
  - preparing request
  - task created
  - queued for generation
  - generating main audio
  - finalizing playable file
  - completed
  - failed
- Estimated progress movement is allowed only within the current backend state bucket:
  - `PENDING`: low progress range with “queued” messaging
  - `GENERATING`: middle progress range with live activity messaging
  - `COMPLETED`: jump to 100 only when the backend confirms completion
- If realtime SSE drops, the UI should transition to a “still checking status” message and continue via polling, not fall back to a confusing generic error immediately.

#### Result card

- Replace the current cramped result section with three visual layers:
  - metadata header
  - player body
  - action row
- Metadata header should show:
  - song title
  - status badge
  - output format
  - real duration once metadata loads
- The player body should prioritize stable single-track playback.
- Volume controls must remain inside the card bounds on desktop and mobile.
- The action row should expose:
  - download
  - share
  - reset/create another
- Button states must support:
  - ready
  - loading
  - disabled
  - failed with actionable feedback

#### Duration handling

- Duration must be populated from actual audio metadata, not from placeholder copy.
- If metadata cannot be read, the UI should show a neutral fallback such as `--:--` or hide the value rather than claiming it is “loading” forever.
- The same duration formatting rules should be reusable in the generate page and other music surfaces when practical.

#### Download behavior

- Generate-page download should remain proxied through `/api/songs/[id]/download` to avoid CORS issues.
- The client should only start file save after verifying the response is successful and is intended to be downloaded.
- If the song is completed but the file is not yet retrievable, show an explicit temporary-unavailable message instead of a generic “download failed”.

### Subproject 2: Dashboard Song Reliability

#### Canonical song access

- Dashboard items should resolve to the authenticated song detail path using song `id`.
- Share flows should continue to use `shareToken`, but dashboard owner actions should not depend on share-token behavior.
- The owner detail flow, audio proxy flow, and download proxy flow must all resolve the same persisted song record after a refresh.

#### Dashboard actions

- Play/open:
  - open the canonical owner detail path for songs that are actually available
  - render status-specific affordances for generating and failed songs
- Download:
  - verify `response.ok` before saving
  - surface backend error states instead of downloading JSON payloads
- Delete:
  - show a visible loading state while the delete request is running
  - refresh the list after success
  - show success or failure feedback so the user knows what happened

#### Persistence and refresh consistency

- The dashboard list, song detail API, audio proxy API, and download API must all read from the same persisted source-of-truth path after refresh.
- In-memory cache may still be used as a fast path, but every user-visible action must work when only the database-backed record is available.
- A song that appears in the dashboard after successful generation must remain openable, playable, and downloadable after page refresh.

### Subproject 3: Playlist Drawer Experience

#### Interaction model

- Keep the user on `src/app/(main)/playlists/page.tsx`.
- Clicking a playlist card opens an in-page drawer.
- The drawer should slide in with a clear layered transition:
  - backdrop dim
  - panel slide
  - staggered content reveal
- The drawer should close with:
  - explicit close button
  - backdrop click
  - escape key

#### Drawer content

- Header:
  - playlist name
  - description
  - song count
  - visibility state
- Body:
  - song list with up-to-date song status
  - per-song actions such as play/open, download, and remove-from-playlist where supported
- Empty state:
  - visually complete empty state with guidance
  - not just a blank frame

#### Data loading

- Opening a drawer should fetch the latest playlist song detail payload rather than relying only on summary card data.
- The drawer must be able to distinguish:
  - playable songs
  - generating songs
  - failed songs
  - missing/deleted songs

## Data Flow

### Generate flow

1. User submits the form.
2. Client validates required fields and shows any pre-generation compression warning.
3. Server creates or updates one canonical song record and starts the existing generation flow.
4. Client listens to SSE and falls back to polling when needed.
5. Presentation-layer progress maps backend truth into richer user-facing stages.
6. Completion loads real audio metadata and updates the result card.
7. Download and share actions use the canonical song id and proxy APIs.

### Dashboard flow

1. Dashboard fetches `/api/songs`.
2. User clicks play/open, download, or delete on one item.
3. The selected action resolves through the same canonical persisted song id.
4. The UI shows success, pending, or failure feedback without silent no-op behavior.

### Playlist flow

1. User opens a playlist card.
2. Client opens the drawer immediately and fetches latest playlist detail data.
3. Drawer renders song states and supported actions.
4. User can inspect and act on songs without leaving the page.

## Error Handling

- Realtime connection loss on the generate page should degrade to polling with non-blocking messaging.
- “Song not found,” “audio unavailable,” “download failed,” “forbidden,” and “delete failed” must be shown as distinct states.
- Buttons must never appear clickable when the action is impossible.
- If a playlist references a song that no longer exists, the drawer should show that item as unavailable rather than silently omitting it.
- Any user-visible error currently swallowed by the UI should be surfaced with a clear banner, toast, inline state, or disabled control.

## Testing Strategy

### Generate page

- Verify progress copy changes over time instead of staying on `Initializing...`.
- Verify result duration appears after metadata loads.
- Verify the result card remains visually stable at narrow and wide widths.
- Verify download succeeds for a completed song and surfaces a proper error for a failed retrieval.

### Dashboard

- Verify a completed song shown in the dashboard opens the owner detail page after refresh.
- Verify dashboard download does not save backend JSON errors as files.
- Verify dashboard delete updates the list and produces visible feedback.

### Playlists

- Verify playlist cards open a drawer instead of navigating away.
- Verify the drawer renders playlist metadata and songs.
- Verify empty, generating, failed, and completed song states render distinctly.

## Out of Scope

- Rewriting the MiniMax provider integration.
- Reintroducing multipart output behavior.
- Large cross-app architecture refactors unrelated to the broken user flows above.
