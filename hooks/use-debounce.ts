import { useState, useEffect, useCallback, useRef } from 'react'

interface UseDebounceOptions {
  delay?: number
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  options: UseDebounceOptions = {}
): [T, () => void] {
  const {
    delay = 300,
    leading = false,
    trailing = true,
    maxWait
  } = options

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallTimeRef = useRef<number>(0)
  const lastInvokeTimeRef = useRef<number>(0)

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
  }, [])

  const invoke = useCallback((...args: Parameters<T>) => {
    lastInvokeTimeRef.current = Date.now()
    return callback(...args)
  }, [callback])

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const isInvoking = shouldInvoke(now)

      lastCallTimeRef.current = now

      if (isInvoking) {
        if (timeoutRef.current === null) {
          return leadingEdge(...args)
        }
        if (maxWait !== undefined) {
          // Handle maxWait
          return trailingEdge(...args)
        }
      }

      if (timeoutRef.current === null) {
        timeoutRef.current = setTimeout(() => timerExpired(...args), delay)
      }

      return undefined

      function shouldInvoke(time: number): boolean {
        const timeSinceLastCall = time - lastCallTimeRef.current
        const timeSinceLastInvoke = time - lastInvokeTimeRef.current

        return (
          lastCallTimeRef.current === 0 ||
          timeSinceLastCall >= delay ||
          timeSinceLastCall < 0 ||
          (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
        )
      }

      function leadingEdge(...args: Parameters<T>) {
        lastInvokeTimeRef.current = lastCallTimeRef.current
        timeoutRef.current = setTimeout(() => timerExpired(...args), delay)
        return leading ? invoke(...args) : undefined
      }

      function trailingEdge(...args: Parameters<T>) {
        timeoutRef.current = null
        if (trailing && lastCallTimeRef.current !== lastInvokeTimeRef.current) {
          return invoke(...args)
        }
        lastCallTimeRef.current = 0
        lastInvokeTimeRef.current = 0
        return undefined
      }

      function timerExpired(...args: Parameters<T>) {
        const now = Date.now()
        if (shouldInvoke(now)) {
          return trailingEdge(...args)
        }
        const timeSinceLastCall = now - lastCallTimeRef.current
        const timeSinceLastInvoke = now - lastInvokeTimeRef.current
        const timeWaiting = delay - timeSinceLastCall
        const shouldCallMaxWait = maxWait !== undefined && timeSinceLastInvoke >= maxWait

        if (shouldCallMaxWait) {
          return trailingEdge(...args)
        }

        timeoutRef.current = setTimeout(() => timerExpired(...args), timeWaiting)
      }
    },
    [callback, delay, leading, trailing, maxWait, invoke]
  ) as T

  useEffect(() => {
    return cancel
  }, [cancel])

  return [debouncedCallback, cancel]
}

// Specialized debounced search hook for geographic queries
export function useDebouncedGeoSearch<T>(
  searchFunction: (lat: number, lon: number, radius: number) => Promise<T>,
  delay = 500
) {
  const [results, setResults] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const search = useCallback(async (lat: number, lon: number, radius: number) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)
    
    try {
      const result = await searchFunction(lat, lon, radius)
      if (!abortControllerRef.current.signal.aborted) {
        setResults(result)
      }
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults(null)
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setLoading(false)
      }
    }
  }, [searchFunction])

  const [debouncedSearch] = useDebounce(search, { delay })

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    search: debouncedSearch,
    results,
    loading,
    error,
    cancel: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      setLoading(false)
    }
  }
}
