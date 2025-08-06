import { useState, useCallback } from 'react'

interface DownloadedArticle {
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
  created?: string
  modified?: string
}

interface UseDownloadArticlesProps {
  year?: number
  month?: number
  limit?: number
  type?: 'recent' | 'events'
}

interface UseDownloadArticlesReturn {
  articles: DownloadedArticle[]
  loading: boolean
  error: string | null
  downloadArticles: () => Promise<void>
  exportToJson: () => void
  exportToCSV: () => void
}

export function useDownloadArticles({
  year = 2025,
  month = 8, // August
  limit = 50,
  type = 'recent'
}: UseDownloadArticlesProps = {}): UseDownloadArticlesReturn {
  const [articles, setArticles] = useState<DownloadedArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const downloadArticles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        limit: limit.toString(),
        type
      })

      console.log(`Downloading ${type} articles for ${year}-${month.toString().padStart(2, '0')}...`)

      const response = await fetch(`/api/download-articles?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        console.log(`Successfully downloaded ${data.articles.length} articles`)
        setArticles(data.articles || [])
      } else {
        throw new Error(data.error || 'Failed to download articles')
      }
    } catch (err) {
      console.error('Error downloading articles:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [year, month, limit, type])

  const exportToJson = useCallback(() => {
    if (articles.length === 0) return

    const dataStr = JSON.stringify(articles, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `wikipedia-articles-${year}-${month.toString().padStart(2, '0')}-${type}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [articles, year, month, type])

  const exportToCSV = useCallback(() => {
    if (articles.length === 0) return

    const csvHeader = 'Title,Extract,Wikipedia Link,Created,Thumbnail\n'
    const csvRows = articles.map(article => {
      const title = `"${article.title.replace(/"/g, '""')}"`
      const extract = `"${article.extract.replace(/"/g, '""').substring(0, 500)}"`
      const link = article.wikipedia_link
      const created = article.created || ''
      const thumbnail = article.thumbnail?.source || ''
      return `${title},${extract},${link},${created},${thumbnail}`
    }).join('\n')

    const csvContent = csvHeader + csvRows
    const dataBlob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `wikipedia-articles-${year}-${month.toString().padStart(2, '0')}-${type}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [articles, year, month, type])

  return {
    articles,
    loading,
    error,
    downloadArticles,
    exportToJson,
    exportToCSV
  }
}
