export default function MapFallback() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center p-6 bg-gray-800/50 rounded-lg border border-gray-700 max-w-md">
        <h2 className="text-xl font-bold mb-4">Interactive Map</h2>
        <p className="mb-4">
          This application features an interactive 3D satellite map showing historical events from around the world.
        </p>
        <p className="text-sm text-gray-400">The map is loading or may not be available in this environment.</p>
      </div>
    </div>
  )
}
