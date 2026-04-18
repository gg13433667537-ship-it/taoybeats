// Global type declarations for in-memory storage

import type { User, Song, Playlist, Preset } from './types'

declare global {
  var systemApiKey: string | undefined
  var systemApiUrl: string | undefined
  var users: Map<string, User> | undefined
  var songs: Map<string, Song> | undefined
  var playlists: Map<string, Playlist> | undefined
  var presets: Map<string, Preset> | undefined
  var adminLogs: Map<string, unknown> | undefined
}

export {}