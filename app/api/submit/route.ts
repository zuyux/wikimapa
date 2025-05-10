import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import fs from "fs"
import path from "path"

function ensureWikimapaFileExists() {
  const filePath = path.join(process.cwd(), "public", "data")
  const jsonPath = path.join(filePath, "wikimapa.json")

  // Create the directory if it doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true })
  }

  // Create the JSON file with an empty array if it doesn't exist
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify([], null, 2))
    console.log("Created empty wikimapa.json file")
  }
}

export async function POST(request: Request) {
  try {
    // Ensure the file exists
    ensureWikimapaFileExists()

    const data = await request.json()

    // Validate required fields
    const requiredFields = ["title", "type", "lat", "lon", "year", "summary", "wikipedia_link"]
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ message: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Create a new event object
    const newEvent = {
      id: uuidv4(),
      type: data.type,
      location: {
        lat: Number.parseFloat(data.lat),
        lon: Number.parseFloat(data.lon),
      },
      year: Number.parseInt(data.year),
      title: data.title,
      summary: data.summary,
      wikipedia_link: data.wikipedia_link,
    }

    // In a real application, you would:
    // 1. Save to a database
    // 2. Implement authentication and authorization
    // 3. Add validation and sanitization

    // For this example, we'll just return success
    // In a production app, you'd save to a database instead
    return NextResponse.json({
      message: "Event submitted successfully",
      event: newEvent,
    })

    /* 
    // Uncomment this code if you want to actually save to the JSON file
    // Note: This won't work in production on Vercel due to read-only filesystem
    
    const filePath = path.join(process.cwd(), "public", "data", "wikimapa.json")
    
    // Read existing data
    let events = []
    try {
      const fileData = fs.readFileSync(filePath, "utf8")
      events = JSON.parse(fileData)
    } catch (error) {
      console.error("Error reading events file:", error)
    }
    
    // Add new event
    events.push(newEvent)
    
    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2))
    
    return NextResponse.json({ 
      message: "Event submitted successfully", 
      event: newEvent 
    })
    */
  } catch (error) {
    console.error("Error submitting event:", error)
    return NextResponse.json({ message: "Failed to submit event" }, { status: 500 })
  }
}
