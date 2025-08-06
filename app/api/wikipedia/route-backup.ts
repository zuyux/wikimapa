import { NextRequest, NextResponse } from 'next/server'

interface WikipediaSearchResult {
  pageid: number
  title: string
  snippet: string
  size: number
  wordcount: number
  timestamp: string
}

interface WikipediaGeosearchResult {
  pageid: number
  title: string
  lat: number
  lon: number
  dist: number
  primary?: boolean
}

interface WikipediaPageContent {
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const radius = searchParams.get('radius') || '10000' // 10km default
  const year = searchParams.get('year')
  const limit = searchParams.get('limit') || '10'

  // Ensure radius doesn't exceed Wikipedia API limit
  const maxRadius = Math.min(parseInt(radius), 10000)

  try {
    let articles: WikipediaPageContent[] = []

    if (lat && lon) {
      // Geospatial search using correct Wikipedia API
      const geosearchResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord=${lat}|${lon}&gsradius=${maxRadius}&gslimit=${limit}&origin=*`
      )
      
      if (!geosearchResponse.ok) {
        throw new Error(`Wikipedia geosearch failed: ${geosearchResponse.statusText}`)
      }

      const geosearchData = await geosearchResponse.json()
      
      // Check for API errors
      if (geosearchData.error) {
        throw new Error(`Wikipedia API error: ${geosearchData.error.info}`)
      }
      
      // Get detailed page content for each result
      const pagePromises = geosearchData.query?.geosearch?.map(async (page: any) => {
        try {
          const pageResponse = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
          )
          if (pageResponse.ok) {
            const pageData = await pageResponse.json()
            return {
              pageid: pageData.pageid,
              title: pageData.title,
              extract: pageData.extract,
              thumbnail: pageData.thumbnail,
              pageimage: pageData.pageimage,
              coordinates: [{ lat: page.lat, lon: page.lon, primary: true }],
              wikipedia_link: pageData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch details for ${page.title}:`, error)
        }
        return null
      }) || []

      const resolvedPages = await Promise.all(pagePromises)
      articles = resolvedPages.filter(page => page !== null) as WikipediaPageContent[]

    } else if (query) {
      // Text search
      const searchResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`
      )

      if (!searchResponse.ok) {
        throw new Error(`Wikipedia search failed: ${searchResponse.statusText}`)
      }

      const searchData = await searchResponse.json()
      const titles = searchData[1] || []

      // Get detailed page content for each result
      const pagePromises = titles.map(async (title: string) => {
        const pageResponse = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
        )
        if (pageResponse.ok) {
          const pageData = await pageResponse.json()
          return {
            pageid: pageData.pageid,
            title: pageData.title,
            extract: pageData.extract,
            thumbnail: pageData.thumbnail,
            pageimage: pageData.pageimage,
            coordinates: pageData.coordinates,
            wikipedia_link: pageData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
          }
        }
        return null
      })

      const resolvedPages = await Promise.all(pagePromises)
      articles = resolvedPages.filter(page => page !== null) as WikipediaPageContent[]
    }

    // Filter by year if provided (this is basic filtering, you might want to enhance this)
    if (year && articles.length > 0) {
      // This is a simple filter - you might want to implement more sophisticated year filtering
      // by analyzing the page content for dates
      articles = articles.filter(article => {
        // Basic year filtering in title or extract
        const targetYear = parseInt(year)
        const yearRegex = new RegExp(`\\b${Math.abs(targetYear)}\\b`)
        return yearRegex.test(article.title) || yearRegex.test(article.extract)
      })
    }

    return NextResponse.json({
      success: true,
      articles,
      count: articles.length
    })

  } catch (error) {
    console.error('Wikipedia API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Wikipedia articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
