import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const TYPING_TTL_MS = 4000
const SEND_THROTTLE_MS = 2500

/**
 * Typing indicators over a *private* Realtime channel. The server only lets
 * members of the conversation join it (see realtime.messages policies).
 */
export function useTyping(conversationId: string, userId: string | null) {
  const [typing, setTyping] = useState<Record<string, number>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastSent = useRef(0)

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`conversation:${conversationId}`, {
      config: { private: true, broadcast: { self: false } },
    })
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const from = (payload as { userId?: string }).userId
        if (!from || from === userId) return
        setTyping((prev) => ({ ...prev, [from]: Date.now() + TYPING_TTL_MS }))
      })
      .on('broadcast', { event: 'stop-typing' }, ({ payload }) => {
        const from = (payload as { userId?: string }).userId
        if (!from) return
        setTyping((prev) => {
          if (!(from in prev)) return prev
          const next = { ...prev }
          delete next[from]
          return next
        })
      })
      .subscribe()
    channelRef.current = channel

    const sweep = window.setInterval(() => {
      setTyping((prev) => {
        const now = Date.now()
        const entries = Object.entries(prev).filter(([, until]) => until > now)
        return entries.length === Object.keys(prev).length ? prev : Object.fromEntries(entries)
      })
    }, 1000)

    return () => {
      window.clearInterval(sweep)
      channelRef.current = null
      setTyping({})
      void supabase.removeChannel(channel)
    }
  }, [conversationId, userId])

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (!userId || now - lastSent.current < SEND_THROTTLE_MS) return
    lastSent.current = now
    void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId } })
  }, [userId])

  const notifyStopped = useCallback(() => {
    if (!userId || lastSent.current === 0) return
    lastSent.current = 0
    void channelRef.current?.send({ type: 'broadcast', event: 'stop-typing', payload: { userId } })
  }, [userId])

  return { typingUserIds: Object.keys(typing), notifyTyping, notifyStopped }
}
