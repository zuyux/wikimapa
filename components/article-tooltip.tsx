import React from 'react'
import { ExternalLink } from 'lucide-react'
import Image from 'next/image'

interface WikipediaArticle {
  pageid: number
  title: string
  extract: string
  thumbnail?: {
    source: string
    width: number
    height: number
  }
  pageimage?: string
  wikipedia_link: string
}

interface ArticleTooltipProps {
  article: WikipediaArticle
  position: { x: number; y: number }
  onClose: () => void
}

export function ArticleTooltip({ article, position, onClose }: ArticleTooltipProps) {
  // Determine tooltip position to avoid going off screen
  const tooltipStyle = {
    left: position.x + 20,
    top: position.y - 10,
    transform: position.x > window.innerWidth / 2 ? 'translateX(-100%)' : 'none',
  }

  return (
    <div
      className="fixed z-50 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg pointer-events-auto"
      style={tooltipStyle}
    >
      <div className="p-4">
        {/* Header with title and close button */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
            {article.title}
          </h3>
          <button
            onClick={onClose}
            className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Thumbnail if available */}
        {article.thumbnail && (
          <div className="mb-3">
            <Image
              src={article.thumbnail.source}
              alt={article.title}
              width={article.thumbnail.width}
              height={article.thumbnail.height}
              className="w-full h-32 object-cover rounded"
            />
          </div>
        )}

        {/* Extract/Summary */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-3">
          {article.extract}
        </p>

        {/* Read more link */}
        <a
          href={article.wikipedia_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          Read on Wikipedia
          <ExternalLink className="ml-1 h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

interface ArticleListProps {
  articles: WikipediaArticle[]
  loading: boolean
  error: string | null
  darkTheme?: boolean
}

export function ArticleList({ articles, loading, error, darkTheme = false }: ArticleListProps) {
  const textColor = darkTheme ? 'text-white' : 'text-gray-900'
  const subtextColor = darkTheme ? 'text-gray-300' : 'text-gray-600'
  const borderColor = darkTheme ? 'border-gray-600' : 'border-gray-100'
  const linkColor = darkTheme ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className={`animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 ${darkTheme ? 'border-blue-400' : 'border-blue-500'} mx-auto mb-2`}></div>
        <p className={`text-sm ${subtextColor}`}>Loading articles...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        <p className="text-sm">Error: {error}</p>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className={`text-sm ${subtextColor}`}>No articles found</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {articles.map((article) => (
        <div key={article.pageid} className={`p-3 border-b ${borderColor} last:border-b-0 hover:bg-gray-800/50 transition-colors`}>
          <div className="flex space-x-3">
            {article.thumbnail && (
              <Image
                src={article.thumbnail.source}
                alt={article.title}
                width={60}
                height={60}
                className="w-15 h-15 object-cover rounded flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <h4 className={`text-sm font-medium ${textColor} mb-1`}>
                {article.title}
              </h4>
              <p className={`text-xs ${subtextColor} line-clamp-2 mb-2`}>
                {article.extract}
              </p>
              <a
                href={article.wikipedia_link}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center text-xs ${linkColor}`}
              >
                Read more
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
