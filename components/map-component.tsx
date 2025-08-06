"use client"

import { useRef, useState, useEffect } from "react"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ExternalLink } from "lucide-react"

// MapTiler API key
const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY

interface WikipediaArticle {
  pageid: number;
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  coordinates?: Array<{
    lat: number;
    lon: number;
    primary?: boolean;
  }>;
  wikipedia_link: string;
}

interface MapComponentProps {
  wikipediaArticles?: WikipediaArticle[]
  onMapMove?: (center: { lat: number; lon: number; zoom: number }) => void
  isLoading?: boolean
}

export default function MapComponent({ wikipediaArticles = [], onMapMove, isLoading = false }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [hoveredArticle, setHoveredArticle] = useState<null | (WikipediaArticle & { x: number; y: number })>(null)
  const wikipediaMarkersRef = useRef<Record<string, maplibregl.Marker>>({})
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [clickedArticle, setClickedArticle] = useState<(WikipediaArticle & { x: number; y: number }) | null>(null)

  useEffect(() => {
    console.log(`Received ${wikipediaArticles?.length || 0} Wikipedia articles`)
  }, [wikipediaArticles])

  // Initialize map
  useEffect(() => {
    if (map.current) return // Map already initialized

    if (!mapContainer.current) {
      console.error("Map container not available")
      setMapError("Map container not available")
      return
    }

    if (!MAPTILER_API_KEY) {
      console.error("MapTiler API key is missing!")
      setMapError("MapTiler API key is missing")
      return
    }

    console.log("Initializing map with API key:", MAPTILER_API_KEY?.slice(0, 8) + "...")

    // Test MapTiler API connectivity before initializing map
    const testMapTilerAPI = async () => {
      try {
        const testUrl = `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_API_KEY}`
        console.log("Testing MapTiler API connectivity...")
        
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          mode: 'no-cors' // Allow CORS preflight
        })
        console.log("MapTiler API test completed")
      } catch (error) {
        console.warn("MapTiler API test failed (this may be normal):", error)
      }
    }

    testMapTilerAPI()

    // Set a timeout to handle stuck loading
    const loadingTimeout = setTimeout(() => {
      if (!mapLoaded) {
        console.error("Map loading timeout")
        setMapError("Map loading timeout - please refresh the page")
      }
    }, 15000) // 15 second timeout

    try {
      console.log("Creating MapLibre GL instance...")
      
      // Initialize map with MapLibre GL JS and MapTiler - start at Gaza Strip
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_API_KEY}`,
        center: [34.3088, 31.3547], // Gaza Strip coordinates
        zoom: 12, // Closer zoom to see articles better
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      })

      console.log("MapLibre GL instance created successfully")

      // Add navigation controls
      if (map.current) {
        const nav = new maplibregl.NavigationControl()
        map.current.addControl(nav, "top-right")

        // Style the controls
        setTimeout(() => {
          const navControls = document.querySelectorAll('.maplibregl-ctrl-top-right .maplibregl-ctrl')
          navControls.forEach(ctrl => {
            (ctrl as HTMLElement).style.background = "#000"
            ;(ctrl as HTMLElement).style.color = "#fff"
            ;(ctrl as HTMLElement).style.border = "1px solid #333"
          })
          const navButtons = document.querySelectorAll('.maplibregl-ctrl-top-right button')
          navButtons.forEach(btn => {
            (btn as HTMLElement).style.background = "#000"
            ;(btn as HTMLElement).style.color = "#fff"
            ;(btn as HTMLElement).style.border = "none"
          })
        }, 100)
      }

      // Add attribution control
      if (map.current) {
        map.current.addControl(
          new maplibregl.AttributionControl({
            compact: true,
          }),
          "bottom-left",
        )
      }

      // Wait for map to load
      if (map.current) {
        map.current.on("load", () => {
          console.log("🗺️ Map loaded successfully")
          clearTimeout(loadingTimeout)
          setMapLoaded(true)
          setMapError(null)
          
          // Add a test marker to verify markers work
          console.log("🧪 Adding test marker to map")
          try {
            const testMarker = new maplibregl.Marker({ color: 'red' })
              .setLngLat([34.3088, 31.3547]) // Gaza Strip coordinates
              .addTo(map.current!)
            console.log("✅ Test marker added successfully")
          } catch (error) {
            console.error("❌ Error adding test marker:", error)
          }
          
          // Trigger initial map move to fetch Wikipedia articles
          if (onMapMove) {
            onMapMove({ lat: 31.3547, lon: 34.3088, zoom: 12 })
          }
        })

        // Add error handling for map loading
        map.current.on("error", (e: any) => {
          console.error("Map loading error:", e)
          clearTimeout(loadingTimeout)
          setMapError(`Map loading failed: ${e.error?.message || 'Unknown error'}`)
        })

        // Add style loading events for debugging
        map.current.on("style.load", () => {
          console.log("Map style loaded successfully")
        })

        map.current.on("sourcedata", (e: any) => {
          if (e.isSourceLoaded) {
            console.log("Map source data loaded:", e.sourceId)
          }
        })

        // Add map move listener
        map.current.on("moveend", () => {
          if (map.current && onMapMove) {
            const center = map.current.getCenter()
            const zoom = map.current.getZoom()
            onMapMove({ lat: center.lat, lon: center.lng, zoom })
          }
        })

        map.current.on("click", (e: any) => {
          const features = map.current!.queryRenderedFeatures(e.point)
          if (features.length === 0) {
            setClickedArticle(null)
          }
        })
      }

    } catch (error) {
      console.error("Error initializing map:", error)
      clearTimeout(loadingTimeout)
      if (error instanceof Error) {
        setMapError(`Map initialization failed: ${error.message}`)
      } else {
        setMapError("Map initialization failed")
      }
    }

    return () => {
      clearTimeout(loadingTimeout)
    }
  }, [onMapMove])

  // Add Wikipedia article markers
  useEffect(() => {
    console.log('🔍 Marker effect triggered:', { 
      hasMap: !!map.current, 
      mapLoaded, 
      articlesCount: wikipediaArticles?.length || 0,
      articles: wikipediaArticles?.slice(0, 2) // Show first 2 articles for debugging
    })

    if (!map.current) {
      console.log('❌ No map reference available')
      return
    }
    
    if (!mapLoaded) {
      console.log('❌ Map not loaded yet')
      return
    }
    
    if (!wikipediaArticles?.length) {
      console.log('❌ No Wikipedia articles available')
      return
    }

    console.log(`✅ All conditions met! Adding ${wikipediaArticles.length} Wikipedia article markers to map`)

    // Clear existing Wikipedia markers
    Object.values(wikipediaMarkersRef.current).forEach(marker => marker.remove())
    wikipediaMarkersRef.current = {}

    // Add new Wikipedia markers
    wikipediaArticles.forEach((article, index) => {
      const coordinates = article.coordinates?.[0]
      if (!coordinates?.lat || !coordinates?.lon) {
        console.log(`❌ Skipping article "${article.title}" - no coordinates:`, article.coordinates)
        return
      }

      console.log(`✅ Creating marker ${index + 1}/${wikipediaArticles.length} for "${article.title}" at:`, coordinates)
      
      try {
        // Use default MapLibre marker
        const maplibreMarker = new maplibregl.Marker()
          .setLngLat([coordinates.lon, coordinates.lat])
          .addTo(map.current!)

        console.log(`🎯 Marker created and added to map for "${article.title}"`)

        // Add click event to the default marker
        maplibreMarker.getElement().addEventListener('click', () => {
          setClickedArticle({
            ...article,
            x: article.coordinates![0].lon,
            y: article.coordinates![0].lat,
          })
        })

        // Add hover event to the default marker
        maplibreMarker.getElement().addEventListener('mouseenter', () => {
          if (!clickedArticle) {
            setHoveredArticle({
              ...article,
              x: article.coordinates![0].lon,
              y: article.coordinates![0].lat,
            })
          }
        })
        
        maplibreMarker.getElement().addEventListener('mouseleave', () => {
          setHoveredArticle(null)
        })

        wikipediaMarkersRef.current[article.pageid.toString()] = maplibreMarker
        console.log(`📍 Marker stored in ref for article: ${article.title}`)
      } catch (error) {
        console.error(`❌ Error creating marker for "${article.title}":`, error)
      }
    })
  }, [wikipediaArticles, mapLoaded, clickedArticle])

  if (mapError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-6 bg-red-900/20 rounded-lg border border-red-800 max-w-md">
          <p className="text-lg font-semibold mb-3">Map Loading Error</p>
          <p className="text-sm text-gray-300 mb-4">{mapError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen">
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="flex flex-col items-center bg-gray-800/90 backdrop-blur-sm p-8 rounded-lg border border-gray-700 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-white mb-2 text-lg font-medium">Loading map...</p>
            <p className="text-sm text-gray-400 text-center">
              Initializing MapLibre GL with MapTiler satellite imagery
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This may take a few seconds...
            </p>
          </div>
        </div>
      )}

      {isLoading && mapLoaded && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
          <div className="flex items-center bg-blue-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-blue-700 shadow-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-3"></div>
            <span className="text-sm">Fetching Wikipedia articles...</span>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />

      {/* Wikipedia article hover tooltip */}
      {hoveredArticle && !clickedArticle && map.current && mapLoaded && (
        <div
          className="absolute z-20 bg-blue-900/90 backdrop-blur-sm text-white p-3 rounded-lg border border-blue-700 shadow-lg max-w-xs"
          style={{
            left: map.current.project([hoveredArticle.x, hoveredArticle.y]).x + 10,
            top: map.current.project([hoveredArticle.x, hoveredArticle.y]).y - 10,
            transform: "translate(0, -100%)",
          }}
        >
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-sm">{hoveredArticle.title}</h3>
            <span className="text-xs bg-blue-800 px-1.5 py-0.5 rounded ml-2">Wikipedia</span>
          </div>
          <p className="text-xs mt-1 text-gray-300">{hoveredArticle.extract.substring(0, 100)}...</p>
          <a
            href={hoveredArticle.wikipedia_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-xs mt-2 text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Read on Wikipedia
          </a>
        </div>
      )}

      {/* Tooltip for clicked Wikipedia article */}
      {clickedArticle && map.current && mapLoaded && (
        <div
          className="absolute z-30 bg-blue-900/95 backdrop-blur-sm text-white p-4 rounded-lg border border-blue-700 shadow-lg max-w-sm"
          style={{
            left: map.current.project([clickedArticle.x, clickedArticle.y]).x,
            top: map.current.project([clickedArticle.x, clickedArticle.y]).y + 20,
            transform: "translate(-50%, 0)",
          }}
        >
          <button
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
            onClick={() => setClickedArticle(null)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg">{clickedArticle.title}</h3>
            <span className="text-xs bg-blue-800 px-2 py-1 rounded ml-2 mt-1">Wikipedia</span>
          </div>
          {clickedArticle.thumbnail && (
            <img
              src={clickedArticle.thumbnail.source}
              alt={clickedArticle.title}
              className="w-full h-32 object-cover rounded mb-3"
            />
          )}
          <p className="text-sm mb-3 text-gray-300">{clickedArticle.extract}</p>
          <div className="flex justify-end items-center mt-4">
            <a
              href={clickedArticle.wikipedia_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Read on Wikipedia
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
