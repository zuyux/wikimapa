import { NextRequest, NextResponse } from 'next/server'

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
  created?: string
  modified?: string
}

// Get recent articles from Wikipedia
async function getRecentArticles(year: number, month: number, limit: number = 50) {
  try {
    // Format month to ensure it's 2 digits
    const formattedMonth = month.toString().padStart(2, '0')
    const startDate = `${year}-${formattedMonth}-01`
    
    // Get the last day of the month
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${formattedMonth}-${lastDay}`

    // Use Wikipedia's recent changes API to get new articles
    const recentChangesResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=recentchanges&rctype=new&rcnamespace=0&rclimit=${limit}&rcstart=${endDate}T23:59:59Z&rcend=${startDate}T00:00:00Z&format=json&origin=*`
    )

    if (!recentChangesResponse.ok) {
      throw new Error(`Recent changes API failed: ${recentChangesResponse.statusText}`)
    }

    const recentChangesData = await recentChangesResponse.json()
    const recentChanges = recentChangesData.query?.recentchanges || []

    // Get detailed information for each new article
    const articles: WikipediaArticle[] = []
    
    for (const change of recentChanges.slice(0, limit)) {
      try {
        // Get page summary
        const summaryResponse = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(change.title)}`
        )

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json()
          
          // Skip disambiguation pages and redirects
          if (summaryData.type === 'standard' && summaryData.extract) {
            articles.push({
              pageid: summaryData.pageid,
              title: summaryData.title,
              extract: summaryData.extract,
              thumbnail: summaryData.thumbnail,
              pageimage: summaryData.pageimage,
              coordinates: summaryData.coordinates,
              wikipedia_link: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(change.title)}`,
              created: change.timestamp,
              modified: change.timestamp
            })
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch details for ${change.title}:`, error)
      }
    }

    return articles
  } catch (error) {
    throw new Error(`Failed to fetch recent articles: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get articles by category for current events
async function getCurrentEventsArticles(year: number, month: number, limit: number = 50) {
  try {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    
    const monthName = monthNames[month - 1]
    const categoryTitle = `${monthName} ${year} events`

    // Search for current events category
    const categoryResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(categoryTitle)}&cmlimit=${limit}&format=json&origin=*`
    )

    if (!categoryResponse.ok) {
      throw new Error(`Category API failed: ${categoryResponse.statusText}`)
    }

    const categoryData = await categoryResponse.json()
    const categoryMembers = categoryData.query?.categorymembers || []

    const articles: WikipediaArticle[] = []

    for (const member of categoryMembers.slice(0, limit)) {
      try {
        const summaryResponse = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(member.title)}`
        )

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json()
          
          if (summaryData.type === 'standard' && summaryData.extract) {
            articles.push({
              pageid: summaryData.pageid,
              title: summaryData.title,
              extract: summaryData.extract,
              thumbnail: summaryData.thumbnail,
              pageimage: summaryData.pageimage,
              coordinates: summaryData.coordinates,
              wikipedia_link: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(member.title)}`,
              created: member.timestamp
            })
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch details for ${member.title}:`, error)
      }
    }

    return articles
  } catch (error) {
    console.warn(`Failed to fetch current events: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2025')
  const month = parseInt(searchParams.get('month') || '8') // August
  const limit = parseInt(searchParams.get('limit') || '50')
  const type = searchParams.get('type') || 'recent' // 'recent' or 'events'

  try {
    let articles: WikipediaArticle[] = []

    if (type === 'events') {
      // Get current events articles
      articles = await getCurrentEventsArticles(year, month, limit)
    } else {
      // Get recently created articles
      articles = await getRecentArticles(year, month, limit)
    }

    // Also try to get some current events if we have space
    if (type === 'recent' && articles.length < limit) {
      const eventsArticles = await getCurrentEventsArticles(year, month, limit - articles.length)
      articles = [...articles, ...eventsArticles]
    }

    // Remove duplicates
    const uniqueArticles = articles.filter((article, index, self) => 
      index === self.findIndex(a => a.pageid === article.pageid)
    )

    return NextResponse.json({
      success: true,
      articles: uniqueArticles,
      count: uniqueArticles.length,
      year,
      month,
      type
    })

  } catch (error) {
    console.error('Download articles API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to download articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
