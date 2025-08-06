import { useState, useEffect, useCallback } from 'react'

interface WikipediaArticle {
  pageid: number
  title: string
  extract: string
  thumbnail?: {
    source: string
    width: number
    height: number
  }
  wikipedia_link: string
  coordinates?: {
    lat: number
    lon: number
  }
  timestamp?: string // When the article was fetched
  radius?: number // The radius it was fetched with
  center?: { lat: number; lon: number } // The center point it was fetched from
}

interface CacheEntry {
  articles: WikipediaArticle[]
  timestamp: number
  params: {
    lat: number
    lon: number
    radius: number
    query?: string
    year?: number
    limit?: number
  }
}

interface UseWikipediaCacheProps {
  lat?: number
  lon?: number
  radius?: number
  query?: string
  year?: number
  limit?: number
  enabled?: boolean
}

const CACHE_KEY = 'wikimapa_articles_cache'
const CACHE_EXPIRY = 1000 * 60 * 60 * 24 // 24 hours
const MAX_CACHE_ENTRIES = 50 // Maximum number of cache entries to keep

export function useWikipediaCache({
  lat,
  lon,
  radius = 5000,
  query,
  year,
  limit = 50,
  enabled = true
}: UseWikipediaCacheProps) {
  const [articles, setArticles] = useState<WikipediaArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, total: 0 })
  const [isClient, setIsClient] = useState(false)
  const [cacheInfo, setCacheInfo] = useState({
    entries: 0,
    totalArticles: 0,
    hitRate: '0%',
    hits: 0,
    misses: 0,
    oldestEntry: 'none'
  })

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load cache from localStorage
  const loadCache = useCallback((): CacheEntry[] => {
    try {
      // Check if we're on the client side
      if (!isClient || typeof window === 'undefined' || !window.localStorage) {
        return []
      }
      
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return []
      const entries: CacheEntry[] = JSON.parse(cached)
      
      // Filter out expired entries
      const now = Date.now()
      const validEntries = entries.filter(entry => 
        now - entry.timestamp < CACHE_EXPIRY
      )
      
      // If we filtered out expired entries, save the cleaned cache
      if (validEntries.length !== entries.length) {
        saveCache(validEntries)
      }
      
      return validEntries
    } catch (error) {
      console.error('Error loading cache:', error)
      return []
    }
  }, [isClient])

  // Save cache to localStorage
  const saveCache = useCallback((entries: CacheEntry[]) => {
    try {
      // Check if we're on the client side
      if (!isClient || typeof window === 'undefined' || !window.localStorage) {
        return
      }
      
      // Keep only the most recent entries if we exceed the limit
      const sortedEntries = entries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_CACHE_ENTRIES)
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(sortedEntries))
    } catch (error) {
      console.error('Error saving cache:', error)
    }
  }, [isClient])

  // Check if we have cached articles for this request
  const findCachedArticles = useCallback((params: {
    lat: number
    lon: number
    radius: number
    query?: string
    year?: number
  }): WikipediaArticle[] | null => {
    const cache = loadCache()
    
    for (const entry of cache) {
      const { params: cachedParams } = entry
      
      // Check if this cache entry covers our request
      const distance = calculateDistance(
        params.lat, params.lon,
        cachedParams.lat, cachedParams.lon
      )
      
      // If the cached entry has a larger or equal radius and the center is close enough
      const isWithinCachedArea = cachedParams.radius >= params.radius && 
        distance <= (cachedParams.radius - params.radius)
      
      // Check if query and year match (if specified)
      const queryMatches = !params.query || !cachedParams.query || 
        cachedParams.query === params.query
      const yearMatches = !params.year || !cachedParams.year || 
        cachedParams.year === params.year
      
      if (isWithinCachedArea && queryMatches && yearMatches) {
        console.log('🎯 Cache HIT:', {
          requestedRadius: params.radius,
          cachedRadius: cachedParams.radius,
          distance: Math.round(distance),
          articles: entry.articles.length,
          cacheAge: Math.round((Date.now() - entry.timestamp) / (1000 * 60)) + ' minutes'
        })
        
        // Filter articles to the requested area and radius
        const filteredArticles = entry.articles.filter(article => {
          if (!article.coordinates) return true // Include articles without coordinates
          const articleDistance = calculateDistance(
            params.lat, params.lon,
            article.coordinates.lat, article.coordinates.lon
          )
          return articleDistance <= params.radius
        })
        
        return filteredArticles
      }
    }
    
    console.log('❌ Cache MISS:', {
      requestedParams: params,
      cacheEntries: cache.length,
      reason: 'No suitable cached data found'
    })
    
    return null
  }, [loadCache])

  // Add new articles to cache
  const addToCache = useCallback((
    articles: WikipediaArticle[],
    params: {
      lat: number
      lon: number
      radius: number
      query?: string
      year?: number
      limit?: number
    }
  ) => {
    const cache = loadCache()
    
    // Add coordinates to articles if not present (estimate from center)
    const articlesWithCoords = articles.map(article => ({
      ...article,
      coordinates: article.coordinates || { lat: params.lat, lon: params.lon },
      timestamp: new Date().toISOString(),
      radius: params.radius,
      center: { lat: params.lat, lon: params.lon }
    }))
    
    const newEntry: CacheEntry = {
      articles: articlesWithCoords,
      timestamp: Date.now(),
      params
    }
    
    const updatedCache = [newEntry, ...cache]
    saveCache(updatedCache)
    
    console.log('💾 Added to cache:', {
      articles: articles.length,
      radius: params.radius,
      totalCacheEntries: updatedCache.length
    })
  }, [loadCache, saveCache])

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Fetch articles with caching
  const fetchArticles = useCallback(async () => {
    if (!enabled || (!query && (!lat || !lon))) {
      setArticles([])
      return
    }

    const params = { lat: lat!, lon: lon!, radius, query, year, limit }
    
    // Check cache first
    const cachedArticles = findCachedArticles(params)
    if (cachedArticles) {
      setArticles(cachedArticles)
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1, total: prev.total + 1 }))
      return
    }

    // Cache miss - fetch from API
    setCacheStats(prev => ({ ...prev, misses: prev.misses + 1, total: prev.total + 1 }))
    
    console.log('🌐 Fetching from API:', params)
    setLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams()
      
      if (query) searchParams.append('query', query)
      if (lat !== undefined) searchParams.append('lat', lat.toString())
      if (lon !== undefined) searchParams.append('lon', lon.toString())
      if (radius) searchParams.append('radius', radius.toString())
      if (year !== undefined) searchParams.append('year', year.toString())
      if (limit) searchParams.append('limit', limit.toString())

      const url = `/api/wikipedia?${searchParams.toString()}`
      console.log('Fetching from URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Fetch error response:', response.status, response.statusText, errorText)
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('API response:', data)
      
      if (data.success) {
        const fetchedArticles = data.articles || []
        console.log('Successfully fetched Wikipedia articles:', fetchedArticles.length, 'articles')
        
        // Add to cache
        addToCache(fetchedArticles, params)
        
        setArticles(fetchedArticles)
      } else {
        console.error('API returned error:', data.error)
        throw new Error(data.error || 'Failed to fetch Wikipedia articles')
      }
    } catch (err) {
      console.error('Error fetching Wikipedia articles:', err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [query, lat, lon, radius, year, limit, enabled, findCachedArticles, addToCache])

  // Effect to fetch articles when parameters change
  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // Clear cache function for debugging
  const clearCache = useCallback(() => {
    if (isClient && typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(CACHE_KEY)
      setCacheStats({ hits: 0, misses: 0, total: 0 })
      console.log('🗑️ Cache cleared')
    }
  }, [isClient])

  // Update cache info when client is ready or cache stats change
  useEffect(() => {
    if (isClient) {
      const updateCacheInfo = () => {
        const cache = loadCache()
        const totalArticles = cache.reduce((sum, entry) => sum + entry.articles.length, 0)
        const hitRate = cacheStats.total > 0 ? (cacheStats.hits / cacheStats.total * 100).toFixed(1) : '0'
        
        setCacheInfo({
          entries: cache.length,
          totalArticles,
          hitRate: `${hitRate}%`,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          oldestEntry: cache.length > 0 ? 
            Math.round((Date.now() - Math.min(...cache.map(e => e.timestamp))) / (1000 * 60)) + ' minutes' : 
            'none'
        })
      }
      
      updateCacheInfo()
    }
  }, [isClient, cacheStats, loadCache])

  return {
    articles,
    loading,
    error,
    refetch: fetchArticles,
    clearCache,
    cacheInfo,
    cacheStats
  }
}
