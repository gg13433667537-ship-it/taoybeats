// Shared global state initialization
// This module should be imported by all API routes

// Global types are declared in src/types/global.d.ts
// This file provides initialization and accessor functions

import type { User, Song } from './types'

// Initialize all globals
export function initGlobals() {
  if (!global.systemApiKey) global.systemApiKey = process.env.MINIMAX_API_KEY
  if (!global.systemApiUrl) global.systemApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com'
  if (!global.users) global.users = new Map()
  if (!global.songs) global.songs = new Map()
  if (!global.playlists) global.playlists = new Map()
  if (!global.presets) global.presets = new Map()
  if (!global.adminLogs) global.adminLogs = new Map()
}

// Export typed accessors
export function getGlobalUsers(): Map<string, User> {
  if (!global.users) global.users = new Map()
  return global.users
}

export function getGlobalSongs(): Map<string, Song> {
  if (!global.songs) global.songs = new Map()
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
