// In-memory LRU cache for API response caching
// Provides O(1) lookup with automatic eviction of old entries

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private defaultTtl: number

  constructor(maxSize: number = 100, defaultTtl: number = 60000) {
    this.maxSize = maxSize
    this.defaultTtl = defaultTtl
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(key: string, data: T, ttl?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    })
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Get cache stats for monitoring
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.keys()),
    }
  }
}

// Global cache instances with sensible defaults
declare global {
  var discoverCache: LRUCache<unknown> | undefined
  var playlistCache: LRUCache<unknown> | undefined
  var songCache: LRUCache<unknown> | undefined
  var generationDeduplication: Map<string, number> | undefined
}

// Initialize caches
if (!global.discoverCache) global.discoverCache = new LRUCache(50, 30000) // 30s TTL for discover
if (!global.playlistCache) global.playlistCache = new LRUCache(100, 60000) // 1min TTL for playlists
if (!global.songCache) global.songCache = new LRUCache(200, 60000) // 1min TTL for songs
if (!global.generationDeduplication) global.generationDeduplication = new Map()

export const discoverCache = global.discoverCache
export const playlistCache = global.playlistCache
export const songCache = global.songCache
export const generationDeduplication = global.generationDeduplication

// Generation request deduplication
// Prevents duplicate generation requests within a time window
export function checkDuplicateGeneration(userId: string, title: string): boolean {
  const key = `${userId}:${title.toLowerCase().trim()}`
  const now = Date.now()
  const windowMs = 30000 // 30 second deduplication window

  const lastRequest = generationDeduplication?.get(key)
  if (lastRequest && now - lastRequest < windowMs) {
    return true // Duplicate detected
  }

  generationDeduplication?.set(key, now)

  // Clean up old entries (older than 1 minute)
  if (generationDeduplication) {
    const entries = Array.from(generationDeduplication.entries())
    for (const [k, v] of entries) {
      if (now - v > 60000) {
        generationDeduplication.delete(k)
      }
    }
  }

  return false
}
