
# Wikimapa

## 🌍 Overview

Wikimapa is an interactive platform that allows users to explore Wikipedia articles spatially and temporally. Users can navigate through a map interface, filter articles by time periods, and delve into the interconnectedness of historical events, figures, and places.

The application features a full-screen 3D satellite map that displays interactive pins for historical events, buildings, and notable figures. Users can filter events by year, search for specific events, and submit new historical points of interest.

## ✨ Features

- **Interactive 3D Map**: Full-screen satellite view powered by MapLibre GL JS and MapTiler
- **Historical Events Timeline**: Filter events from ancient history to modern times with a year slider
- **Interactive Markers**: Color-coded markers for different types of historical entries (events, buildings, people)
- **Event Details**: Click on markers to view detailed information and links to Wikipedia articles
- **Search Functionality**: Find specific historical events by title
- **Event Submission**: Submit new historical events through a user-friendly form
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Technologies

- **Frontend**: Next.js, React, Tailwind CSS
- **Map**: MapLibre GL JS, MapTiler
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Data Storage**: JSON (with API endpoint for submissions)

## 📋 Prerequisites

- Node.js 18.x or higher
- npm or yarn
- MapTiler API key (free tier available)

## 🚀 Getting Started

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/wikimapa.git
   cd wikimapa
   ```

2. Install dependencies:

```shellscript
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory and add your MapTiler API key:

```plaintext
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_api_key
```


4. Start the development server:

```shellscript
npm run dev
# or
yarn dev
```


5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.


### Building for Production

```shellscript
npm run build
npm run start
# or
yarn build
yarn start
```

## ⚙️ Configuration

### MapTiler API Key

You need to obtain a MapTiler API key to use the map functionality:

1. Sign up for a free account at [MapTiler Cloud](https://www.maptiler.com/cloud/)
2. Create a new API key
3. Add the key to your `.env.local` file as shown in the installation instructions
4. Alternatively, you can directly replace the placeholder in `components/map-component.tsx`:


```javascript
const MAPTILER_API_KEY = "your_maptiler_api_key" // Replace with your MapTiler key
```

### Event Data

The application loads historical event data from `public/data/wikimapa.json`. You can modify this file to add or remove events.

Each event should follow this structure:

```json
{
  "id": "unique-event-id",
  "type": "event", // or "building" or "person"
  "location": { "lat": 50.9116, "lon": 0.4870 },
  "year": 1066, // Use negative values for BCE
  "title": "Event Title",
  "summary": "Brief description of the event.",
  "wikipedia_link": "https://en.wikipedia.org/wiki/Event_Title"
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [MapLibre GL JS](https://maplibre.org/) for the open-source mapping library
- [MapTiler](https://www.maptiler.com/) for the beautiful map tiles
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) for the UI components
- [Lucide React](https://lucide.dev/) for the icons
- Wikipedia for the wealth of historical information


---

Developed with ❤️ by fabohax at zuyux