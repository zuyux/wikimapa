"use client"

import { useRef, useState, useEffect } from "react"

// Extend the Window interface to include maplibregl
declare global {
  interface Window {
    maplibregl: any;
  }
}
import { ExternalLink } from "lucide-react"
import Script from "next/script"

// MapTiler API key - replace with your own in production
// For production, use environment variables
const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY; // Replace with your MapTiler key

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
}

export default function MapComponent({ events }: MapComponentProps) {
  const mapContainer = useRef(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<null | (Event & { x: number; y: number })>(null)
  const markersRef = useRef<Record<string, maplibregl.Marker>>({})
  const [mapLoaded, setMapLoaded] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [clickedEvent, setClickedEvent] = useState<(Event & { x: number; y: number }) | null>(null)

  // Handle script load event
  const handleScriptLoad = () => {
    console.log("MapLibre script loaded successfully")
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
      console.log("Waiting for MapLibre GL JS to load...")
      return
    }

    if (map.current) return // Map already initialized

    console.log("Initializing map...")

    try {
      // Initialize map with MapLibre GL JS and MapTiler
      map.current = new window.maplibregl.Map({
        container: mapContainer.current,
        style: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_API_KEY}`,
        center: [0, 20], // Start at a global view
        zoom: 1.5,
        pitch: 30, // Give it a slight 3D perspective
        attributionControl: false,
      })

      // Add navigation controls
      if (map.current) {
        map.current.addControl(new window.maplibregl.NavigationControl(), "bottom-right")
      }

      // Add attribution control in a more subtle way
      map.current.addControl(
        new window.maplibregl.AttributionControl({
          compact: true,
        }),
        "bottom-left",
      )

      // Wait for map to load before adding markers
      map.current.on("load", () => {
        // Map is ready
        console.log("Map loaded successfully")
        setMapLoaded(true)
      })

      map.current.on("click", (e: maplibregl.MapMouseEvent & maplibregl.EventData) => {
        // Check if the click is on a marker or on the map
        const features: maplibregl.MapboxGeoJSONFeature[] = map.current.queryRenderedFeatures(e.point)
        if (features.length === 0) {
          // Clicked on the map (not on a marker), close the tooltip
          setClickedEvent(null)
        }
      })

      // Handle map errors
      map.current.on("error", (e: maplibregl.MapboxEvent & { error?: Error }) => {
        console.error("Map error:", e)
        setScriptError("Map initialization error")
      })
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

  if (scriptError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-4 bg-red-900/20 rounded-lg border border-red-800 max-w-md">
          <p className="text-lg font-semibold mb-2">Map Error</p>
          <p className="text-sm text-gray-300">{scriptError}</p>
          <p className="mt-4 text-xs text-gray-400">Please check your internet connection and try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen">
      {/* Load MapLibre GL JS from CDN with onLoad handler */}
      <Script
        src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"
        onLoad={handleScriptLoad}
        onError={handleScriptError}
        strategy="afterInteractive"
      />

      {!scriptLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-white">Loading map library...</p>
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
