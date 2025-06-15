"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import SubmitEventModal from "@/components/submit-event-modal"

// Import Map component directly since we're handling the loading state inside it
import MapComponent from "@/components/map-component"

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [yearRange, setYearRange] = useState([2020, 2025]) // default range 2020 to 2025
  const [initialYear, setInitialYear] = useState(2020)     // default initial year 2020
  const [latestYear, setLatestYear] = useState(2025)       // default latest year 2025
  interface Event {
    id: string
    title: string
    year: number
    type: string
    summary: string
    location: {
      lat: number
      lng: number
    }
    wikipedia_link: string
  }

  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch the events data with better error handling
    setIsLoading(true)
    fetch("/data/wikimapa.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`)
        }
        return res.text() // Get as text first to check content
      })
      .then((text) => {
        try {
          // Try to parse as JSON
          const data = JSON.parse(text)
          setEvents(data)
          setFilteredEvents(data)
          setError(null)
        } catch (e) {
          console.error("Invalid JSON:", text.substring(0, 100) + "...")
          throw new Error("Invalid JSON response")
        }
      })
      .catch((error) => {
        console.error("Error loading event data:", error)
        setError(error.message)
        // Set empty arrays to prevent further errors
        setEvents([])
        setFilteredEvents([])
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    // Filter events based on search term and year range
    const filtered = events.filter((event) => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesYear = event.year >= yearRange[0] && event.year <= yearRange[1]
      return matchesSearch && matchesYear
    })
    setFilteredEvents(filtered)
  }, [searchTerm, yearRange, events])

  // When initialYear changes, update slider and its placeholder if needed
  useEffect(() => {
    setYearRange((prev) => [
      Math.max(prev[0], initialYear),
      Math.min(prev[1], latestYear),
    ])
  }, [initialYear, latestYear])

  // Add filter for event type
  const [eventType, setEventType] = useState<string>("all")
  const eventTypeOptions = [
    { value: "all", label: "All" },
    { value: "event", label: "Events" },
    { value: "person", label: "Humans" },
    { value: "place", label: "Places" },
    { value: "building", label: "Structures" },
  ]

  // Filter events by year and type
  const filtered = events.filter((event) => {
    const matchesYear = event.year >= initialYear && event.year <= latestYear
    const matchesType = eventType === "all" ? true : event.type === eventType
    return matchesYear && matchesType
  })

  const handleYearChange = (value: number[]) => {
    setYearRange(value)
  }

  const formatYear = (year: number): string => {
    return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`
  }

  const hasEvents = events.length > 0

  return (
    <main className="relative h-screen w-full overflow-hidden bg-gray-900">
      {/* Map Component */}
      {isLoading ? (
        <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p>Loading data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
          <p className="mb-4 text-red-400">Error: {error}</p>
          <p className="text-sm text-gray-400 max-w-md text-center">
            Make sure the file exists at: /public/data/wikimapa.json and contains valid JSON data
          </p>
        </div>
      ) : hasEvents ? (
        <MapComponent
          events={filtered
            .filter(
              (event) =>
                typeof event.location?.lng === "number" &&
                typeof event.location?.lat === "number" &&
                !isNaN(event.location.lng) &&
                !isNaN(event.location.lat)
            )
            .map((event) => ({
              ...event,
              location: {
                lon: event.location.lng,
                lat: event.location.lat,
              },
            }))}
        />
      ) : (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
          <p className="mb-4">No events found</p>
          <p className="text-sm text-gray-400">Add events using the "Submit an Event" button</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="absolute flex top-4 left-4 z-10 w-50">
        <Image src="/wikimapa.svg" alt="Logo" width={21} height={21} className="mr-2 opacity-50" />
        <div className="relative">
          <Input
            type="text"
            placeholder="Search wikipedia articles..."
            className="px-4 bg-gray-900/80 backdrop-blur-sm rounded-full w-500 border-gray-700 text-white outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Submit Event Button 
      <div className="absolute top-4 right-12 z-10">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-gray-900/80 backdrop-blur-sm hover:bg-gray-800 text-white border border-gray-700 rounded-lg"
        >
          Submit
        </Button>
      </div>*/}

      {/* Simple filter bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gray-900/80 backdrop-blur-sm px-4 py-3 border-t border-gray-700 flex flex-col md:flex-row md:items-center md:justify-center gap-4">
        <select
          className="bg-transparent border border-gray-700 rounded-full px-4 py-1 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={eventType}
          onChange={e => setEventType(e.target.value)}
        >
          {eventTypeOptions.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-white">from</span>
        <input
          type="number"
          className="bg-transparent border border-gray-700 rounded-full px-4 py-1 w-24 text-white"
          value={initialYear}
          min={-3000}
          max={latestYear}
          onChange={e => {
            const val = Math.max(-3000, Math.min(Number(e.target.value), latestYear))
            setInitialYear(val)
          }}
        />
        <span className="text-white">to</span>
        <input
          type="number"
          className="bg-transparent border border-gray-700 rounded-full px-4 py-1 w-24 text-white"
          value={latestYear}
          min={initialYear}
          max={2025}
          onChange={e => {
            const val = Math.min(2025, Math.max(Number(e.target.value), initialYear))
            setLatestYear(val)
          }}
        />
      </div>

      {/* Year Range Slider */}
      {hasEvents && (
        <div className="absolute bottom-14 left-0 right-0 z-10">
          <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-700">
            <Slider
              min={-3000}
              max={2025}
              step={1}
              value={yearRange}
              defaultValue={[2020, 2025]}
              onValueChange={setYearRange}
              className="w-full"
            />
            {/* ...decade markers if present... */}
          </div>
        </div>
      )}

      {/* Submit Event Modal */}
      <SubmitEventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  )
}
