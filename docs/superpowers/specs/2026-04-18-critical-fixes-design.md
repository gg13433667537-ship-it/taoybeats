# Critical Bug Fixes Design

**Date**: 2026-04-18
**Status**: Approved for Implementation
**Priority**: P0/P1

---

## Problem Summary

Multiple critical bugs prevent the app from being commercially viable:
1. Audio URLs from MiniMax expire after 24 hours
2. Songs show "not found" despite COMPLETED status
3. Session state lost on navigation (UI issue)
4. Delete button non-responsive
5. Playlist creation non-responsive
6. All style/mood/instrument options are English-only
7. Reference singer list needs localization (30 Chinese + 30 Western)

---

## Solutions

### 1. R2 Audio Persistence (P0)

**Problem**: MiniMax audio URLs expire after 24 hours

**Solution**:
- Use Cloudflare R2 to store audio files permanently
- After MiniMax generation completes, immediately download audio to R2
- Store R2 URL (permanent) in database instead of MiniMax URL
- R2 has 10GB/month free tier with no egress fees

**Files to modify**:
- `src/lib/r2-storage.ts` (NEW)
- `src/app/api/songs/route.ts`

### 2. Audio URL Field Fix (P0)

**Problem**: Inconsistent field name between `generate()` (uses `audio`) and `mapMusicStatus()` (uses `audio_url`)

**Solution**:
- Standardize on `audio_url` as the field name (MiniMax uses this for URL output format)
- Fix `generate()` line 152: change `data.data?.audio` to `data.data?.audio_url`

**Files to modify**:
- `src/lib/ai-providers.ts`

### 3. Session UI Refresh Fix (P0)

**Problem**: UserDropdown shows logged-out state after navigation

**Solution**:
- Add `usePathname` or `useRouter` hook to force re-render on route change
- Or add `key` prop to UserDropdown based on router state

**Files to modify**:
- `src/components/UserDropdown.tsx`

### 4. Delete Button Fix (P0)

**Problem**: Click on delete button produces no response

**Solution**:
- Check event handler binding in dashboard page
- Ensure `handleDeleteSong` is properly passed and called
- Add error handling and user feedback

**Files to modify**:
- `src/app/(main)/dashboard/page.tsx`

### 5. Playlist Creation Fix (P0)

**Problem**: "Create playlist" button produces no response

**Solution**:
- Check if playlist API route exists
- Check if frontend is properly connected to backend
- Implement missing functionality

**Files to modify**:
- `src/app/api/playlists/route.ts` (check/create)
- `src/app/(main)/dashboard/page.tsx`

### 6. UI Chinese Localization (P1)

**Problem**: All style, mood, instrument options are English-only

**Solution**:
- Update i18n translations for all options
- Style/Mood/Instrument arrays need Chinese labels

**Files to modify**:
- `src/lib/i18n.tsx`
- `src/app/(main)/generate/page.tsx`

### 7. Reference Singer Lists (P2)

**Problem**: Need 30 Chinese + 30 Western popular singers

**Solution**:
- Create data file with singer lists
- Implement locale-based selection

**Files to modify**:
- `src/lib/data/reference-singers.ts` (NEW)
- `src/components/VoiceSelector.tsx` or generate page

---

## Implementation Order

1. Fix audio URL field (quick win, unblocks testing)
2. R2 storage integration (core infrastructure)
3. Session UI fix
4. Delete button fix
5. Playlist creation fix
6. UI Chinese localization
7. Reference singer lists

---

## Notes

- R2 credentials needed: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- All 20 agents will run in parallel on independent tasks
