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
  const [yearRange, setYearRange] = useState([-3000, 2025])
  interface Event {
    title: string
    year: number
    // Add other properties of your event object here if needed
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
        <MapComponent events={filteredEvents} />
      ) : (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
          <p className="mb-4">No events found</p>
          <p className="text-sm text-gray-400">Add events using the "Submit an Event" button</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="absolute flex top-4 left-4 z-10 w-full md:w-400">
        <Image src="/wikimapa.svg" alt="Logo" width={21} height={21} className="mr-2 opacity-50" />
        <div className="relative">
          <Input
            type="text"
            placeholder="Search historical points..."
            className="bg-gray-900/80 backdrop-blur-sm rounded-lg w-full border-gray-700 text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Submit Event Button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-gray-900/80 backdrop-blur-sm hover:bg-gray-800 text-white border border-gray-700 rounded-lg"
        >
          Submit
        </Button>
      </div>

      {/* Year Slider */}
      {hasEvents && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 w-4/5 max-w-3xl">
          <div className="bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg border border-gray-700">
            <div className="flex justify-between mb-2 text-gray-300 text-sm">
              <span>{formatYear(yearRange[0])}</span>
              <span>{formatYear(yearRange[1])}</span>
            </div>
            <Slider
              defaultValue={[-3000, 2025]}
              min={-3000}
              max={2025}
              step={1}
              value={yearRange}
              onValueChange={handleYearChange}
              className="w-full"
            />
            <div className="mt-2 text-center text-white text-sm">
              Showing events from {formatYear(yearRange[0])} to {formatYear(yearRange[1])}
            </div>
          </div>
        </div>
      )}

      {/* Submit Event Modal */}
      <SubmitEventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  )
}
