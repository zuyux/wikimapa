"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ChevronDown, ChevronUp, Search, Filter, BookOpen, ArrowRight, ChevronsLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useSimpleWikipedia } from "@/hooks/use-simple-wikipedia"
import { ArticleList } from "@/components/article-tooltip"

// Import Map component directly since we're handling the loading state inside it
import MapComponent from "@/components/map-component"

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("")
  const [fromYear, setFromYear] = useState<number>(2020) // Start from 2020 to include recent events
  const [toYear, setToYear] = useState<number>(2025) // Current year
  const [fromMonth, setFromMonth] = useState<number | null>(null) // No month restriction
  const [toMonth, setToMonth] = useState<number | null>(null) // No month restriction
  const [isArticlesListCollapsed, setIsArticlesListCollapsed] = useState(false) // Start expanded by default
  
  // Map state - Gaza Strip coordinates
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number; zoom: number }>({ 
    lat: 31.3547, 
    lon: 34.3088, 
    zoom: 12 
  })

  // Calculate dynamic radius based on zoom level
  const calculateRadius = (zoom: number): number => {
    if (zoom >= 15) return 1000   // 1km for close zoom
    if (zoom >= 12) return 5000   // 5km for city level
    return 10000                  // 10km (max) for wider views
  }

  // Wikipedia API hook
  const {
    articles: wikipediaArticles,
    loading: wikipediaLoading,
    error: wikipediaError
  } = useSimpleWikipedia({
    lat: mapCenter.lat,
    lon: mapCenter.lon,
    radius: calculateRadius(mapCenter.zoom),
    enabled: true
  })

  // Manual refetch function for the refresh button
  const refetchWikipedia = () => {
    // Force a re-render by slightly changing coordinates
    setMapCenter(prev => ({ ...prev, lat: prev.lat + 0.0001 }))
    setTimeout(() => {
      setMapCenter(prev => ({ ...prev, lat: prev.lat - 0.0001 }))
    }, 100)
  }

  // Debug logging for Wikipedia articles
  useEffect(() => {
    console.log('📚 Wikipedia articles updated:', {
      count: wikipediaArticles.length,
      loading: wikipediaLoading,
      error: wikipediaError,
      articles: wikipediaArticles.slice(0, 3) // Log first 3 articles
    })
  }, [wikipediaArticles, wikipediaLoading, wikipediaError])

  // Debug logging for hook parameters
  useEffect(() => {
    console.log('🔧 Wikipedia hook parameters:', {
      lat: mapCenter.lat,
      lon: mapCenter.lon,
      radius: calculateRadius(mapCenter.zoom),
      zoom: mapCenter.zoom,
      enabled: true
    })
  }, [mapCenter.lat, mapCenter.lon, mapCenter.zoom])

  const [filteredWikipediaArticles, setFilteredWikipediaArticles] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // Debug logging for map center changes
  useEffect(() => {
    console.log('🗺️ Map center state:', mapCenter)
    if (mapCenter.lat !== 0 && mapCenter.lon !== 0) {
      console.log('✅ Map center is valid:', mapCenter)
    } else {
      console.log('❌ Map center is invalid:', mapCenter)
    }
  }, [mapCenter])

  // Filter and sort Wikipedia articles by timeframe, search term, and zoom level
  useEffect(() => {
    console.log('Filtering articles:', { 
      total: wikipediaArticles.length, 
      searchTerm, 
      fromYear, 
      toYear, 
      fromMonth, 
      toMonth,
      zoom: mapCenter.zoom
    })
    
    let filtered = [...wikipediaArticles]

    // Apply search term filtering first
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(searchLower)
        const extractMatch = article.extract.toLowerCase().includes(searchLower)
        return titleMatch || extractMatch
      })
      console.log(`Search "${searchTerm}" filtered to ${filtered.length} articles`)
    }

    // Apply timeframe filtering
    if (fromYear || toYear || fromMonth || toMonth) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      filtered = filtered.filter(article => {
        const extract = article.extract.toLowerCase()
        
        // Check for year mentions in the extract
        let yearMatch = true
        if (fromYear || toYear) {
          const years: number[] = []
          const yearRegex = /\b(19|20)\d{2}\b/g
          let match
          while ((match = yearRegex.exec(extract)) !== null) {
            years.push(parseInt(match[0]))
          }
          
          if (years.length > 0) {
            const latestYear = Math.max(...years)
            if (fromYear && latestYear < fromYear) yearMatch = false
            if (toYear && latestYear > toYear) yearMatch = false
          }
        }
        
        // Check for month mentions in the extract
        let monthMatch = true
        if (fromMonth || toMonth) {
          const monthIndices: number[] = []
          monthNames.forEach((month, index) => {
            if (extract.includes(month.toLowerCase())) {
              monthIndices.push(index + 1)
            }
          })
          
          if (monthIndices.length > 0) {
            const latestMonth = Math.max(...monthIndices)
            if (fromMonth && latestMonth < fromMonth) monthMatch = false
            if (toMonth && latestMonth > toMonth) monthMatch = false
          }
        }
        
        return yearMatch && monthMatch
      })
      
      console.log(`Timeframe filtering: ${filtered.length} articles match`)
    }

    // Smart sorting based on zoom level and recency
    filtered.sort((a, b) => {
      // Extract years from articles for recency scoring
      const getLatestYear = (article: any): number => {
        const extract = article.extract.toLowerCase()
        const yearRegex = /\b(19|20)\d{2}\b/g
        const years: number[] = []
        let match
        while ((match = yearRegex.exec(extract)) !== null) {
          years.push(parseInt(match[0]))
        }
        return years.length > 0 ? Math.max(...years) : 2000
      }

      const yearA = getLatestYear(a)
      const yearB = getLatestYear(b)

      // Zoom-based prioritization
      if (mapCenter.zoom <= 10) {
        // Zoomed out: prioritize latest/most recent articles
        return yearB - yearA // Latest first
      } else if (mapCenter.zoom <= 12) {
        // Medium zoom: balance between recency and relevance
        const recencyScoreA = (yearA - 1900) / 125
        const recencyScoreB = (yearB - 1900) / 125
        const titleLengthA = a.title.length
        const titleLengthB = b.title.length
        
        const scoreA = recencyScoreA * 0.7 + (1 - titleLengthA / 100) * 0.3
        const scoreB = recencyScoreB * 0.7 + (1 - titleLengthB / 100) * 0.3
        
        return scoreB - scoreA
      } else {
        // Zoomed in: prioritize more specific/detailed articles
        const detailScoreA = a.extract.length + (a.thumbnail ? 50 : 0)
        const detailScoreB = b.extract.length + (b.thumbnail ? 50 : 0)
        return detailScoreB - detailScoreA
      }
    })

    // Limit articles based on zoom level
    let maxArticles = 50
    if (mapCenter.zoom <= 10) {
      maxArticles = 20
    } else if (mapCenter.zoom <= 12) {
      maxArticles = 35
    }
    
    const finalArticles = filtered.slice(0, maxArticles)
    
    console.log(`Final filtered articles: ${finalArticles.length} (from ${wikipediaArticles.length} total)`)
    
    setFilteredWikipediaArticles(finalArticles)
  }, [wikipediaArticles, searchTerm, fromYear, toYear, fromMonth, toMonth, mapCenter.zoom])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Full screen map container */}
      <div className="fixed inset-0 w-full h-full">
        {/* Map container */}
        <div className="w-full h-full relative">
          <MapComponent 
            wikipediaArticles={filteredWikipediaArticles}
            onMapMove={setMapCenter}
            isLoading={wikipediaLoading}
          />
        </div>

        {/* Left sidebar with articles list */}
        <Card className={`absolute left-2 md:left-4 top-2 md:top-4 bg-black/95 backdrop-blur-md border-gray-700 transition-all duration-300 ease-in-out z-10 ${
          isArticlesListCollapsed ? 'w-10 md:w-12 h-10 md:h-12' : 'w-80 md:w-96 bottom-16 md:bottom-4'
        }`}>
          {/* Collapse/expand button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsArticlesListCollapsed(!isArticlesListCollapsed)}
            className={`absolute top-0 right-0 text-white hover:bg-gray-800/50 transition-colors duration-200 ${
              isArticlesListCollapsed 
                ? 'w-10 md:w-12 h-10 md:h-12 rounded-lg' 
                : 'w-10 md:w-12 h-10 md:h-12 border-b border-gray-700 rounded-none rounded-tr-lg'
            }`}
            title={isArticlesListCollapsed ? "Expand articles list" : "Collapse articles list"}
          >
            {isArticlesListCollapsed ? (
              <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <ChevronsLeft className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </Button>

          {/* Articles list content */}
          {!isArticlesListCollapsed && (
            <CardContent className="h-full flex flex-col overflow-hidden p-0 pt-12">
              {/* Header */}
              <CardHeader className="p-3 md:p-4 pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-base md:text-lg">
                  <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Wikipedia Articles</span>
                  <span className="sm:hidden">Articles</span>
                  {wikipediaLoading && (
                    <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin ml-auto"></div>
                  )}
                </CardTitle>
                
                <div className="flex items-center gap-1 md:gap-2 mt-2 md:mt-3 flex-wrap">
                  <Badge variant="secondary" className="bg-blue-900/50 text-blue-200 border-blue-700 text-xs">
                    {filteredWikipediaArticles.length} articles
                  </Badge>
                  <Badge variant="outline" className="text-gray-400 border-gray-600 text-xs">
                    Gaza Strip
                  </Badge>
                </div>
              </CardHeader>

              <Separator className="bg-gray-700" />

              {/* Search section */}
              <div className="p-3 md:p-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 md:w-4 md:h-4" />
                  <Input
                    type="text"
                    placeholder="Search articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 pl-8 md:pl-10 h-8 md:h-9 text-sm"
                  />
                </div>
                
                {searchTerm && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-yellow-900/50 text-yellow-200 border-yellow-700 text-xs">
                      <Filter className="w-3 h-3 mr-1" />
                      Filtered
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="text-gray-400 hover:text-white text-xs h-6"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              <Separator className="bg-gray-700" />

              {/* Articles list */}
              <ScrollArea className="flex-1 min-h-0 px-2 md:px-4 h-[calc(100vh-16rem)] md:h-[calc(100vh-20rem)]">
                <div className="min-h-full flex flex-col">
                  {wikipediaError ? (
                  <Card className="m-2 bg-red-950/50 border-red-800">
                    <CardContent className="p-3">
                      <p className="text-red-400 text-sm">
                        Error: {wikipediaError}
                      </p>
                    </CardContent>
                  </Card>
                ) : filteredWikipediaArticles.length > 0 ? (
                  <div className="py-2">
                    <ArticleList 
                      articles={filteredWikipediaArticles}
                      loading={wikipediaLoading}
                      error={wikipediaError}
                      darkTheme={true}
                    />
                  </div>
                ) : wikipediaLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-400 text-sm">Loading articles...</p>
                    </div>
                  </div>
                ) : (
                  <Card className="m-2 bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <BookOpen className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No articles found</p>
                      <p className="text-gray-500 text-xs mt-1">Try adjusting your search or timeframe</p>
                    </CardContent>
                  </Card>
                )}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Bottom controls */}
      <Card className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-gray-800 rounded-none z-20">
        <CardContent className="p-2 md:p-4">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
            {/* Logo and title */}
            <div className="flex items-center gap-2 md:gap-3 justify-center lg:justify-start">
              <div className="flex items-center gap-1 md:gap-2">
                <Image src="/wikimapa.svg" alt="Logo" width={20} height={20} className="opacity-80 md:w-6 md:h-6" />
                <h1 className="text-lg md:text-xl font-bold text-white">WikiMapa</h1>
              </div>
              <Badge variant="outline" className="text-gray-400 border-gray-600 text-xs">
                <span className="hidden sm:inline">Historical Explorer</span>
                <span className="sm:hidden">Explorer</span>
              </Badge>
            </div>

            {/* Time range controls */}
            <Card className="bg-gray-900/50 border-gray-700 w-full lg:w-auto">
              <CardContent className="p-2 md:p-3">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 lg:gap-6">
                  <div className="flex items-center gap-1 md:gap-2 w-full sm:w-auto lg:w-auto min-w-0">
                    <label className="text-xs md:text-sm text-gray-300 font-medium whitespace-nowrap w-10 text-left">From:</label>
                    <Input
                      type="number"
                      min="1900"
                      max="2030"
                      value={fromYear}
                      onChange={(e) => setFromYear(parseInt(e.target.value))}
                      className="bg-gray-800 border-gray-600 text-white w-20 md:w-20 h-7 md:h-8 text-xs md:text-sm flex-shrink-0"
                    />
                    <select
                      value={fromMonth || ""}
                      onChange={(e) => setFromMonth(e.target.value ? parseInt(e.target.value) : null)}
                      className="bg-gray-800 border border-gray-600 rounded px-1 md:px-2 py-1 text-xs md:text-sm text-white h-7 md:h-8 w-20 md:w-24 flex-1 sm:flex-none"
                    >
                      <option value="">All</option>
                      {[
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"
                      ].map((month, index) => (
                        <option key={index} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </div>

                  <Separator orientation="vertical" className="h-6 bg-gray-600 hidden sm:block" />

                  <div className="flex items-center gap-1 md:gap-2 w-full sm:w-auto lg:w-auto min-w-0">
                    <label className="text-xs md:text-sm text-gray-300 font-medium whitespace-nowrap w-10 text-left">To:</label>
                    <Input
                      type="number"
                      min="1900"
                      max="2030"
                      value={toYear}
                      onChange={(e) => setToYear(parseInt(e.target.value))}
                      className="bg-gray-800 border-gray-600 text-white w-20 md:w-20 h-7 md:h-8 text-xs md:text-sm flex-shrink-0"
                    />
                    <select
                      value={toMonth || ""}
                      onChange={(e) => setToMonth(e.target.value ? parseInt(e.target.value) : null)}
                      className="bg-gray-800 border border-gray-600 rounded px-1 md:px-2 py-1 text-xs md:text-sm text-white h-7 md:h-8 w-20 md:w-24 flex-1 sm:flex-none"
                    >
                      <option value="">All</option>
                      {[
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"
                      ].map((month, index) => (
                        <option key={index} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </div>

                  {/* Refresh button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchWikipedia()}
                    disabled={wikipediaLoading}
                    className="bg-blue-600 hover:bg-blue-700 border-blue-600 text-white h-7 md:h-8 px-2 md:px-3 w-full sm:w-auto"
                    title="Update articles with current date filters"
                  >
                    {wikipediaLoading ? (
                      <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
