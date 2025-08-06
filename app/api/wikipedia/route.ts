import { NextRequest, NextResponse } from 'next/server'

interface WikipediaGeoResult {
  pageid: number
  title: string
  lat: number
  lon: number
  dist: number
  primary?: boolean
}

interface WikipediaSearchResult {
  title: string
  pageid: number
}

interface WikipediaPage {
  pageid: number
  title: string
  extract?: string
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
}

interface WikipediaArticle extends WikipediaPage {
  wikipedia_link: string
}

// In-memory cache for API responses
const apiCache = new Map<string, { data: any, timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_ENTRIES = 200

// Cache cleanup function
function cleanupApiCache() {
  const now = Date.now()
  for (const [key, entry] of apiCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      apiCache.delete(key)
    }
  }
  
  // Limit cache size
  if (apiCache.size > MAX_CACHE_ENTRIES) {
    const sortedEntries = Array.from(apiCache.entries())
      .sort(([,a], [,b]) => b.timestamp - a.timestamp)
    
    apiCache.clear()
    sortedEntries.slice(0, MAX_CACHE_ENTRIES).forEach(([key, value]) => {
      apiCache.set(key, value)
    })
  }
}

// Optimized fetch with timeout and retries
async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000), // 8 second timeout
        headers: {
          'User-Agent': 'WikiMapa/1.0 (https://wikimapa.com; contact@wikimapa.com)'
        }
      })
      
      if (response.ok) {
        return response
      }
      
      // If it's a rate limit, wait a bit before retry
      if (response.status === 429 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        continue
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  throw new Error('Max retries exceeded')
}

// Batch page details fetching with optimized chunking
async function fetchPageDetails(pageIds: number[]): Promise<WikipediaPage[]> {
  if (pageIds.length === 0) return []
  
  const BATCH_SIZE = 20 // Optimal batch size for Wikipedia API
  const batches: number[][] = []
  
  for (let i = 0; i < pageIds.length; i += BATCH_SIZE) {
    batches.push(pageIds.slice(i, i + BATCH_SIZE))
  }
  
  // Process batches concurrently but limited
  const CONCURRENT_BATCHES = 3
  const results: WikipediaPage[] = []
  
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES)
    
    const batchPromises = batchGroup.map(async (batch) => {
      const cacheKey = `pages:${batch.join(',')}`
      
      // Check cache first
      const cached = apiCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data
      }
      
      try {
        // Use Wikipedia API to fetch multiple pages efficiently
        const pageIds = batch.join('|')
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&pageids=${pageIds}&prop=extracts|pageimages|coordinates&exintro=1&explaintext=1&exsectionformat=plain&piprop=thumbnail&pithumbsize=150&pilimit=1&colimit=1&origin=*`
        
        const response = await fetchWithRetry(url)
        const data = await response.json()
        
        if (data.query?.pages) {
          const pages = Object.values(data.query.pages) as any[]
          const processedPages = pages.map(page => ({
            pageid: page.pageid,
            title: page.title,
            extract: page.extract || '',
            thumbnail: page.thumbnail,
            pageimage: page.pageimage,
            coordinates: page.coordinates
          }))
          
          // Cache the result
          apiCache.set(cacheKey, { data: processedPages, timestamp: Date.now() })
          return processedPages
        }
      } catch (error) {
        console.error(`Error fetching batch ${batch}:`, error)
        
        // Fallback: fetch pages individually
        const individualPromises = batch.map(async (pageId) => {
          try {
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageId}`
            const response = await fetchWithRetry(summaryUrl)
            const data = await response.json()
            
            return {
              pageid: pageId,
              title: data.title || `Page ${pageId}`,
              extract: data.extract || '',
              thumbnail: data.thumbnail,
              pageimage: data.pageimage,
              coordinates: data.coordinates || []
            }
          } catch (error) {
            console.warn(`Failed to fetch summary for page ${pageId}:`, error)
            return {
              pageid: pageId,
              title: `Page ${pageId}`,
              extract: '',
              coordinates: []
            }
          }
        })
        
        const fallbackResults = await Promise.allSettled(individualPromises)
        const successfulResults = fallbackResults
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<WikipediaPage>).value)
        
        return successfulResults
      }
      
      return []
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults.flat())
  }
  
  return results
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const radius = searchParams.get('radius') || '10000'
  const year = searchParams.get('year')
  const limit = searchParams.get('limit') || '10'

  // Generate cache key
  const cacheKey = `api:${query || 'geo'}:${lat}:${lon}:${radius}:${year}:${limit}`
  
  // Check cache first
  const cached = apiCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      articles: cached.data,
      cached: true
    })
  }

  // Ensure radius doesn't exceed Wikipedia API limit
  const maxRadius = Math.min(parseInt(radius), 10000)
  const parsedLimit = Math.min(parseInt(limit), 50) // Cap at 50

  try {
    let searchResults: Array<{ pageid: number, title: string }> = []

    if (query) {
      // Text search with caching
      const searchCacheKey = `search:${query}:${limit}`
      const searchCached = apiCache.get(searchCacheKey)
      
      if (searchCached && Date.now() - searchCached.timestamp < CACHE_DURATION) {
        searchResults = searchCached.data
      } else {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${parsedLimit}&format=json&origin=*`
        
        const searchResponse = await fetchWithRetry(searchUrl)
        const searchData = await searchResponse.json()
        
        if (searchData && searchData[1] && Array.isArray(searchData[1])) {
          const titles = searchData[1] as string[]
          
          // Get page IDs for titles
          const titleParams = titles.map(title => encodeURIComponent(title)).join('|')
          const pageIdUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${titleParams}&origin=*`
          
          const pageIdResponse = await fetchWithRetry(pageIdUrl)
          const pageIdData = await pageIdResponse.json()
          
          if (pageIdData.query?.pages) {
            searchResults = Object.values(pageIdData.query.pages).map((page: any) => ({
              pageid: page.pageid,
              title: page.title
            }))
          }
        }
        
        // Cache search results
        apiCache.set(searchCacheKey, { data: searchResults, timestamp: Date.now() })
      }
    } else if (lat && lon) {
      // Geospatial search with caching
      const geoCacheKey = `geo:${lat}:${lon}:${maxRadius}:${limit}`
      const geoCached = apiCache.get(geoCacheKey)
      
      if (geoCached && Date.now() - geoCached.timestamp < CACHE_DURATION) {
        searchResults = geoCached.data
      } else {
        const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${maxRadius}&gslimit=${parsedLimit}&format=json&origin=*`
        
        const geoResponse = await fetchWithRetry(geoUrl)
        const geoData = await geoResponse.json()
        
        if (geoData.query?.geosearch) {
          searchResults = geoData.query.geosearch.map((result: WikipediaGeoResult) => ({
            pageid: result.pageid,
            title: result.title
          }))
        }
        
        // Cache geo results
        apiCache.set(geoCacheKey, { data: searchResults, timestamp: Date.now() })
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either query or lat/lon coordinates are required'
      }, { status: 400 })
    }

    if (searchResults.length === 0) {
      // Cache empty results too
      apiCache.set(cacheKey, { data: [], timestamp: Date.now() })
      return NextResponse.json({
        success: true,
        articles: [],
        message: 'No articles found for the given criteria'
      })
    }

    // Fetch page details in optimized batches
    const pageIds = searchResults.map(result => result.pageid).filter(id => id > 0)
    const pageDetails = await fetchPageDetails(pageIds)

    // Filter by year if specified
    let filteredArticles = pageDetails
    if (year) {
      const yearNum = parseInt(year)
      filteredArticles = pageDetails.filter(article => {
        return article.extract && article.extract.includes(yearNum.toString())
      })
    }

    // Convert to final format
    const articles: WikipediaArticle[] = filteredArticles.map(page => ({
      ...page,
      wikipedia_link: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
    }))

    // Cache the final result
    apiCache.set(cacheKey, { data: articles, timestamp: Date.now() })
    
    // Cleanup cache periodically
    if (Math.random() < 0.1) { // 10% chance
      cleanupApiCache()
    }

    return NextResponse.json({
      success: true,
      articles,
      count: articles.length,
      cached: false
    })

  } catch (error) {
    console.error('Wikipedia API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
