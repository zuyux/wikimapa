"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SubmitEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubmitEventModal({ isOpen, onClose }: SubmitEventModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    type: "event",
    lat: "",
    lon: "",
    year: "",
    summary: "",
    wikipedia_link: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as { name: keyof FormData; value: string };
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, type: value }))
  }

  interface FormData {
    title: string;
    type: string;
    lat: string;
    lon: string;
    year: string;
    summary: string;
    wikipedia_link: string;
  }

  interface SubmitResponse {
    ok: boolean;
    json: () => Promise<{ message?: string }>;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Validate form
      if (
        !formData.title ||
        !formData.lat ||
        !formData.lon ||
        !formData.year ||
        !formData.summary ||
        !formData.wikipedia_link
      ) {
        throw new Error("All fields are required");
      }

      // Validate coordinates
      const lat = Number.parseFloat(formData.lat);
      const lon = Number.parseFloat(formData.lon);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error("Latitude must be between -90 and 90");
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error("Longitude must be between -180 and 180");
      }

      // Validate year
      const year = Number.parseInt(formData.year);
      if (isNaN(year) || year < -10000 || year > new Date().getFullYear()) {
        throw new Error("Please enter a valid year");
      }

      // Validate Wikipedia link
      if (!formData.wikipedia_link.startsWith("https://en.wikipedia.org/wiki/")) {
        throw new Error("Please enter a valid Wikipedia link");
      }

      // Submit the form
      const response: SubmitResponse = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          lat: Number.parseFloat(formData.lat),
          lon: Number.parseFloat(formData.lon),
          year: Number.parseInt(formData.year),
          location: {
            lat: Number.parseFloat(formData.lat),
            lon: Number.parseFloat(formData.lon),
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to submit event");
      }

      // Show success message
      setSuccess(true);

      // Reset form after 2 seconds and close modal
      setTimeout(() => {
        setFormData({
          title: "",
          type: "event",
          lat: "",
          lon: "",
          year: "",
          summary: "",
          wikipedia_link: "",
        });
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Submit a History Point</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Battle of Hastings"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={handleSelectChange}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="person">Figure</SelectItem>
                <SelectItem value="building">Building/Monument</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                name="lat"
                value={formData.lat}
                onChange={handleChange}
                placeholder="50.9116"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lon">Longitude</Label>
              <Input
                id="lon"
                name="lon"
                value={formData.lon}
                onChange={handleChange}
                placeholder="0.4870"
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              placeholder="1066 (use negative values for BCE)"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              placeholder="Brief description of the historical event..."
              className="bg-gray-800 border-gray-700 min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wikipedia_link">Wikipedia Link</Label>
            <Input
              id="wikipedia_link"
              name="wikipedia_link"
              value={formData.wikipedia_link}
              onChange={handleChange}
              placeholder="https://en.wikipedia.org/wiki/Battle_of_Hastings"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          {error && <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-900">{error}</div>}

          {success && (
            <div className="text-green-400 text-sm p-2 bg-green-900/20 rounded border border-green-900">
              Event submitted successfully!
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? "Submitting..." : "Submit Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
