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
  pageimage?: string
  coordinates?: Array<{
    lat: number
    lon: number
    primary?: boolean
  }>
  wikipedia_link: string
}

interface UseWikipediaProps {
  query?: string
  lat?: number
  lon?: number
  radius?: number
  year?: number
  limit?: number
  enabled?: boolean
}

interface UseWikipediaReturn {
  articles: WikipediaArticle[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export const useWikipedia = ({
  query,
  lat,
  lon,
  radius = 10000,
  year,
  limit = 10,
  enabled = true
}: UseWikipediaProps): UseWikipediaReturn => {
  const [articles, setArticles] = useState<WikipediaArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArticles = useCallback(async () => {
    if (!enabled || (!query && (!lat || !lon))) {
      console.log('❌ Wikipedia hook disabled or missing params:', { enabled, query, lat, lon })
      setArticles([])
      return
    }

    console.log('🔍 Fetching Wikipedia articles:', { query, lat, lon, radius, year, limit })
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      
      if (query) params.append('query', query)
      if (lat !== undefined) params.append('lat', lat.toString())
      if (lon !== undefined) params.append('lon', lon.toString())
      if (radius) params.append('radius', radius.toString())
      if (year !== undefined) params.append('year', year.toString())
      if (limit) params.append('limit', Math.min(limit, 50).toString())

      const url = `/api/wikipedia?${params.toString()}`
      console.log('📡 Fetching from URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📊 Wikipedia API response:', data)
      
      if (data.success) {
        const fetchedArticles = data.articles || []
        console.log('✅ Successfully fetched Wikipedia articles:', fetchedArticles.length)
        setArticles(fetchedArticles)
      } else {
        throw new Error(data.error || 'Failed to fetch Wikipedia articles')
      }
    } catch (err) {
      console.error('❌ Error fetching Wikipedia articles:', err)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [query, lat, lon, radius, year, limit, enabled])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchArticles()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [fetchArticles])

  const refetch = useCallback(() => {
    fetchArticles()
  }, [fetchArticles])

  return {
    articles,
    loading,
    error,
    refetch
  }
}
