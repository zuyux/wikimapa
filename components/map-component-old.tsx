"use client"

import { useRef, useState, useEffect } from "react"
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ExternalLink } from "lucide-react"

// MapTiler API key - replace with your own in production
// For production, use environment variables
const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY; // Replace with your MapTiler key

console.log('MapTiler API Key available:', !!MAPTILER_API_KEY)

interface Event {
  id: string;
  type: string;
  title: string;
  summary: string;
  year: number;
  location: {
    lon: number;
    lat: number;
  };
  wikipedia_link: string;
}

interface MapComponentProps {
  events: Event[];
  onMapMove?: (center: { lat: number; lon: number }) => void;
}

export default function MapComponent({ events, onMapMove }: MapComponentProps) {
  const mapContainer = useRef(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<null | (Event & { x: number; y: number })>(null)
  const markersRef = useRef<Record<string, any>>({})
  const [mapLoaded, setMapLoaded] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [clickedEvent, setClickedEvent] = useState<(Event & { x: number; y: number }) | null>(null)

  // Handle script load event
  const handleScriptLoad = () => {
    console.log("MapLibre script loaded successfully")
    console.log("window.maplibregl available:", !!window.maplibregl)
    setScriptLoaded(true)
  }

  // Handle script error event
  const handleScriptError = () => {
    console.error("Failed to load MapLibre script")
    setScriptError("Failed to load map library")
  }

  useEffect(() => {
    // Log when events change
    console.log(`Received ${events?.length || 0} events`)
  }, [events])

  // Initialize map after script is loaded
  useEffect(() => {
    if (!scriptLoaded || !window.maplibregl) {
      console.log("Waiting for MapLibre GL JS to load...", { scriptLoaded, hasMapLibre: !!window.maplibregl })
      return
    }

    if (map.current) return // Map already initialized

    if (!MAPTILER_API_KEY) {
      console.error("MapTiler API key is missing!")
      setScriptError("MapTiler API key is missing")
      return
    }

    console.log("Initializing map with API key:", MAPTILER_API_KEY.substring(0, 8) + "...")

    try {
      // Initialize map with MapLibre GL JS and MapTiler
      map.current = new window.maplibregl.Map({
        container: mapContainer.current,
        style: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_API_KEY}`,
        center: [0, 20], // Start at a global view
        zoom: 1.5,
        pitch: 0, // Orthographic (perpendicular) view
        bearing: 0, // No rotation
        attributionControl: false,
      })

      // Add navigation controls to top-right and style them
      if (map.current) {
        const nav = new window.maplibregl.NavigationControl()
        map.current.addControl(nav, "top-right")

        // Wait for the controls to be rendered, then style them
        setTimeout(() => {
          const navControls = document.querySelectorAll('.maplibregl-ctrl-top-right .maplibregl-ctrl')
          navControls.forEach(ctrl => {
            (ctrl as HTMLElement).style.background = "#000"
            ;(ctrl as HTMLElement).style.color = "#fff"
            ;(ctrl as HTMLElement).style.border = "1px solid #333"
          })
          // Style the buttons inside the controls
          const navButtons = document.querySelectorAll('.maplibregl-ctrl-top-right button')
          navButtons.forEach(btn => {
            (btn as HTMLElement).style.background = "#000"
            ;(btn as HTMLElement).style.color = "#fff"
            ;(btn as HTMLElement).style.border = "none"
          })
        }, 100)
      }

      // Add attribution control in a more subtle way
      if (map.current) {
        map.current.addControl(
          new window.maplibregl.AttributionControl({
            compact: true,
          }),
          "bottom-left",
        )
      }

      // Wait for map to load before adding markers
      if (map.current) {
        map.current.on("load", () => {
          // Map is ready
          console.log("Map loaded successfully")
          setMapLoaded(true)
        })

        // Add map move listener for Wikipedia integration
        map.current.on("moveend", () => {
          if (map.current && onMapMove) {
            const center = map.current.getCenter()
            onMapMove({ lat: center.lat, lon: center.lng })
          }
        })
      }

      if (map.current) {
        map.current.on("click", (e: any) => {
          // Check if the click is on a marker or on the map
          const features = map.current!.queryRenderedFeatures(e.point)
          if (features.length === 0) {
            // Clicked on the map (not on a marker), close the tooltip
            setClickedEvent(null)
          }
        })
      }

      // Handle map errors
      if (map.current) {
        map.current.on("error", (e: any) => {
          console.error("Map error:", e)
          setScriptError("Map initialization error")
        })
      }
    } catch (error) {
      console.error("Error initializing map:", error)
      if (error instanceof Error) {
        setScriptError(error.message)
      } else {
        setScriptError("An unknown error occurred")
      }
    }

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [scriptLoaded])

  // Handle events changes - add/remove markers
  useEffect(() => {
    if (!map.current || !mapLoaded || !events || events.length === 0 || !window.maplibregl) return

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove())
    markersRef.current = {}

    // Add new markers for each event
    events.forEach((event) => {
      // Create marker element
      const el = document.createElement("div")
      el.className = "marker"

      // Style based on event type
      let markerColor
      switch (event.type) {
        case "event":
          markerColor = "#ffffff"
          break
        case "building":
          markerColor = "#ffffff"
          break
        case "person":
          markerColor = "#ffffff"
          break
        default:
          markerColor = "#FFFFFF"
      }

      el.style.backgroundColor = markerColor
      el.style.width = "12px"
      el.style.height = "12px"
      el.style.borderRadius = "50%"
      el.style.cursor = "grab" // Change cursor to grab
      el.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.25)"
      el.style.transition = "all 0.3s ease"

      // Add event listeners
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.5)"
        el.style.cursor = "grab" // Ensure grab cursor on hover
        // Only show hover tooltip if no marker is currently clicked
        if (!clickedEvent) {
          setHoveredEvent({
            ...event,
            x: event.location.lon,
            y: event.location.lat,
          })
        }
      })

      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)"
        setHoveredEvent(null)
      })

      el.addEventListener("click", () => {
        setClickedEvent({
          ...event,
          x: event.location.lon,
          y: event.location.lat,
        })
      })

      // Create and store the marker
      const marker = new window.maplibregl.Marker(el)
        .setLngLat([event.location.lon, event.location.lat])
        .addTo(map.current)

      markersRef.current[event.id] = marker
    })
  }, [events, mapLoaded, clickedEvent])

  if (scriptError || loadingTimeout) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-6 bg-red-900/20 rounded-lg border border-red-800 max-w-md">
          <p className="text-lg font-semibold mb-3">Map Loading Error</p>
          <p className="text-sm text-gray-300 mb-4">{scriptError}</p>
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Possible solutions:</p>
            <ul className="text-xs text-gray-400 text-left space-y-1">
              <li>• Check your internet connection</li>
              <li>• Verify MapTiler API key is valid</li>
              <li>• Refresh the page</li>
              <li>• Try disabling ad blockers</li>
            </ul>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen">
      {/* Load MapLibre GL JS from CDN with onLoad handler */}
      <Script
        src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"
        onLoad={handleScriptLoad}
        onError={handleScriptError}
        strategy="afterInteractive"
      />
      
      {/* Fallback CDN in case the first one fails */}
      {!scriptLoaded && loadingTimeout && (
        <Script
          src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"
          onLoad={handleScriptLoad}
          onError={handleScriptError}
          strategy="afterInteractive"
        />
      )}

      {!scriptLoaded && !scriptError && !loadingTimeout && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-white mb-2">Loading map library...</p>
            <p className="text-xs text-gray-400">This may take a few seconds</p>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />

      {/* Tooltip for hovered event */}
      {hoveredEvent && !clickedEvent && map.current && mapLoaded && (
        <div
          className="absolute z-20 bg-gray-900/90 backdrop-blur-sm text-white p-3 rounded-lg border border-gray-700 shadow-lg max-w-xs"
          style={{
            left: map.current.project([hoveredEvent.x, hoveredEvent.y]).x + 10,
            top: map.current.project([hoveredEvent.x, hoveredEvent.y]).y - 10,
            transform: "translate(0, -100%)",
          }}
        >
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-sm">{hoveredEvent.title}</h3>
            <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded ml-2">
              {hoveredEvent.year < 0 ? `${Math.abs(hoveredEvent.year)} BCE` : `${hoveredEvent.year} CE`}
            </span>
          </div>
          <p className="text-xs mt-1 text-gray-300">{hoveredEvent.summary}</p>
          <a
            href={hoveredEvent.wikipedia_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-xs mt-2 text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Read on Wikipedia
          </a>
        </div>
      )}
      {/* Tooltip for clicked event */}
      {clickedEvent && map.current && mapLoaded && (
        <div
          className="absolute z-30 bg-gray-900/95 backdrop-blur-sm text-white p-4 rounded-lg border border-gray-700 shadow-lg max-w-sm"
          style={{
            left: map.current.project([clickedEvent.x, clickedEvent.y]).x,
            top: map.current.project([clickedEvent.x, clickedEvent.y]).y + 20,
            transform: "translate(-50%, 0)",
          }}
        >
          <button
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
            onClick={() => setClickedEvent(null)}
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
            <h3 className="font-bold text-lg">{clickedEvent.title}</h3>
            <span className="text-xs bg-gray-800 px-2 py-1 rounded ml-2 mt-1">
              {clickedEvent.year < 0 ? `${Math.abs(clickedEvent.year)} BCE` : `${clickedEvent.year} CE`}
            </span>
          </div>
          <p className="text-sm mb-3 text-gray-300">{clickedEvent.summary}</p>
          <div className="flex justify-between items-center mt-4">
            <span className="text-xs text-gray-400 capitalize">{clickedEvent.type}</span>
            <a
              href={clickedEvent.wikipedia_link}
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
