"use client"

import { useRef, useEffect, useState } from "react"

declare global {
  interface Window {
    maplibregl: any;
  }
}

export default function TestMapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("Initializing...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkMapLibre = () => {
      console.log("Checking MapLibre availability...")
      
      if (typeof window === 'undefined') {
        setStatus("Window not available (SSR)")
        return
      }

      if (!window.maplibregl) {
        setStatus("MapLibre not loaded yet, trying to load...")
        
        // Dynamically load MapLibre
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js'
        script.onload = () => {
          console.log("MapLibre script loaded!")
          setStatus("MapLibre loaded, checking API...")
          
          // Check if we can create a map
          if (window.maplibregl && mapContainer.current) {
            try {
              const testMap = new window.maplibregl.Map({
                container: mapContainer.current,
                style: 'https://demotiles.maplibre.org/style.json', // Use demo tiles instead of MapTiler
                center: [0, 0],
                zoom: 1
              })
              
              testMap.on('load', () => {
                setStatus("Map successfully loaded!")
              })
              
              testMap.on('error', (e: any) => {
                console.error("Map error:", e)
                setError(`Map error: ${e.error?.message || 'Unknown error'}`)
              })
              
            } catch (err) {
              console.error("Error creating map:", err)
              setError(`Error creating map: ${err}`)
            }
          }
        }
        
        script.onerror = () => {
          console.error("Failed to load MapLibre script")
          setError("Failed to load MapLibre script")
        }
        
        document.head.appendChild(script)
        
        // Also load CSS
        const css = document.createElement('link')
        css.rel = 'stylesheet'
        css.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css'
        document.head.appendChild(css)
        
      } else {
        setStatus("MapLibre already available!")
        console.log("MapLibre GL version:", window.maplibregl.version)
      }
    }

    // Wait a bit for Next.js hydration
    const timer = setTimeout(checkMapLibre, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="w-full h-screen bg-gray-900 text-white">
      <div className="absolute top-4 left-4 z-10 bg-black/80 p-4 rounded">
        <h3 className="font-bold mb-2">Map Debug Info</h3>
        <p className="text-sm">Status: {status}</p>
        {error && <p className="text-sm text-red-400">Error: {error}</p>}
        <p className="text-sm">MapLibre available: {typeof window !== 'undefined' && window.maplibregl ? 'Yes' : 'No'}</p>
      </div>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
