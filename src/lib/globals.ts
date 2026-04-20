// Shared global state initialization
// This module should be imported by all API routes
// Auto-initializes globals when imported

// Global types are declared in src/types/global.d.ts
// This file provides initialization and accessor functions

import type { User, Song } from './types'

// Max sizes to prevent unbounded Map growth
const MAX_MAP_SIZE = 1000

// Helper to evict oldest entries when Map is at capacity
function evictOldest<T>(map: Map<string, T>): void {
  if (map.size >= MAX_MAP_SIZE) {
    const firstKey = map.keys().next().value
    if (firstKey) map.delete(firstKey)
  }
}

// Initialize all globals on module load (auto-initialization for serverless)
if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.playlists) global.playlists = new Map()
if (!global.presets) global.presets = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

// Export for explicit initialization if needed
export function initGlobals() {
  if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
  if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
  if (!global.users) global.users = new Map()
  if (!global.songs) global.songs = new Map()
  if (!global.playlists) global.playlists = new Map()
  if (!global.presets) global.presets = new Map()
  if (!global.adminLogs) global.adminLogs = new Map()
}

// Export typed accessors with eviction support
export function getGlobalUsers(): Map<string, User> {
  if (!global.users) global.users = new Map()
  evictOldest(global.users)
  return global.users
}

export function getGlobalSongs(): Map<string, Song> {
  if (!global.songs) global.songs = new Map()
  evictOldest(global.songs)
  return global.songs
}

export function getGlobalApiKey(): string {
  if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
  return global.systemApiKey || ''
}

export function getGlobalApiUrl(): string {
  if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
  return global.systemApiUrl || 'https://api.minimaxi.com'
}
