import { useState, useEffect } from 'react'

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

interface UseSimpleWikipediaProps {
  lat?: number
  lon?: number
  radius?: number
  enabled?: boolean
}

export function useSimpleWikipedia({ lat, lon, radius = 10000, enabled = true }: UseSimpleWikipediaProps) {
  const [articles, setArticles] = useState<WikipediaArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !lat || !lon) {
      console.log('❌ Simple Wikipedia hook - not enabled or missing coordinates:', { enabled, lat, lon })
      return
    }

    const fetchArticles = async () => {
      console.log('🔍 Simple Wikipedia hook - fetching articles:', { lat, lon, radius })
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          lat: lat.toString(),
          lon: lon.toString(),
          radius: radius.toString(),
          limit: '10'
        })

        const url = `/api/wikipedia?${params.toString()}`
        console.log('📡 Fetching from:', url)
        
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('📊 API Response:', data)

        if (data.success) {
          setArticles(data.articles || [])
          console.log('✅ Successfully set articles:', data.articles?.length || 0)
        } else {
          throw new Error(data.error || 'Failed to fetch articles')
        }
      } catch (err) {
        console.error('❌ Simple Wikipedia error:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch articles')
        setArticles([])
      } finally {
        setLoading(false)
      }
    }

    // Add a small delay to avoid rapid-fire requests
    const timeoutId = setTimeout(fetchArticles, 500)
    return () => clearTimeout(timeoutId)
  }, [lat, lon, radius, enabled])

  return { articles, loading, error }
}
