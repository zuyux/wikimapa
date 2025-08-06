// Cache utilities for Wikipedia data
// This provides a centralized caching system with smart invalidation

export interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
}

export class SmartCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private ttl: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttl = ttlMs
    
    // Start periodic cleanup
    this.startCleanup()
  }

  set(key: string, data: T): void {
    const now = Date.now()
    
    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    
    // Check if expired
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    
    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = now
    
    return entry.data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    const entries = Array.from(this.cache.values())
    
    return {
      size: this.cache.size,
      avgAccessCount: entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length || 0,
      expiredCount: entries.filter(entry => now - entry.timestamp > this.ttl).length,
      oldestEntry: Math.min(...entries.map(entry => entry.timestamp)),
      newestEntry: Math.max(...entries.map(entry => entry.timestamp))
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 2 * 60 * 1000) // Cleanup every 2 minutes
  }

  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key))
    
    if (keysToDelete.length > 0) {
      console.debug(`Cleaned up ${keysToDelete.length} expired cache entries`)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Create global cache instances
export const articleCache = new SmartCache(150, 5 * 60 * 1000) // 5 minutes TTL
export const geoCache = new SmartCache(100, 10 * 60 * 1000) // 10 minutes TTL for geographic data
export const searchCache = new SmartCache(50, 3 * 60 * 1000) // 3 minutes TTL for search results

// Utility functions for cache key generation
export function generateLocationCacheKey(lat: number, lon: number, radius: number): string {
  // Round to reasonable precision for better cache hits
  const gridSize = 0.01 // ~1km
  const gridLat = Math.round(lat / gridSize) * gridSize
  const gridLon = Math.round(lon / gridSize) * gridSize
  return `geo:${gridLat.toFixed(4)},${gridLon.toFixed(4)},${radius}`
}

export function generateSearchCacheKey(query: string, limit: number): string {
  return `search:${query.toLowerCase().trim()}:${limit}`
}

export function generateArticleCacheKey(pageIds: number[]): string {
  return `articles:${pageIds.sort().join(',')}`
}

// Cache warming utility
export async function warmCache(locations: Array<{lat: number, lon: number}>, radius = 10000) {
  console.log('Warming cache for locations:', locations.length)
  
  // This could be called on app startup or when user moves to new areas
  const promises = locations.map(async ({lat, lon}) => {
    const key = generateLocationCacheKey(lat, lon, radius)
    
    if (!geoCache.has(key)) {
      try {
        // Simulate API call - in real app this would call your Wikipedia API
        const response = await fetch(`/api/wikipedia?lat=${lat}&lon=${lon}&radius=${radius}&limit=10`)
        if (response.ok) {
          const data = await response.json()
          geoCache.set(key, data.articles || [])
        }
      } catch (error) {
        console.debug('Cache warming failed for', key, error)
      }
    }
  })
  
  await Promise.allSettled(promises)
  console.log('Cache warming completed')
}
