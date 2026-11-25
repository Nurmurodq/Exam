import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const HEARTBEAT_MS = 30_000

/** Keeps profiles.last_seen_at fresh while the app is open and visible. */
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const beat = () => {
      if (document.hidden) return
      // Query builders are lazy: .then() is what actually sends the request.
      supabase.rpc('touch_last_seen').then(({ error }) => error && console.warn('heartbeat failed', error.message))
    }
    beat()
    const timer = window.setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    window.addEventListener('focus', beat)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', beat)
      window.removeEventListener('focus', beat)
    }
  }, [enabled])
}

/** Re-renders periodically so "online" / "last seen" labels stay accurate. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useMediaQueryCoarsePointer() {
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  return coarse
}
