import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { errorMessage } from '../lib/errors'
import { avatarUrl } from '../lib/storage'
import { conversationTitle } from '../lib/conversation'
import type { ConversationSummary, Member, Message, Profile } from '../lib/types'

export type MemberRow = Omit<Member, 'profile'>
type MessageListener = (type: 'INSERT' | 'UPDATE', message: Message) => void
type MemberListener = (type: 'INSERT' | 'UPDATE', member: MemberRow) => void

interface ChatContextValue {
  conversations: ConversationSummary[]
  loading: boolean
  error: string | null
  connected: boolean
  totalUnread: number
  refresh: () => Promise<void>
  getConversation: (id: string) => ConversationSummary | undefined
  profiles: Record<string, Profile>
  rememberProfiles: (profiles: Profile[]) => void
  onMessage: (listener: MessageListener) => () => void
  onMember: (listener: MemberListener) => () => void
  setActiveConversation: (id: string | null) => void
  markRead: (conversationId: string) => void
  openDirectChat: (userId: string) => Promise<string>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  const messageListeners = useRef(new Set<MessageListener>())
  const memberListeners = useRef(new Set<MemberListener>())
  const activeId = useRef<string | null>(null)
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations
  const profilesRef = useRef(profiles)
  profilesRef.current = profiles

  const rememberProfiles = useCallback((list: Profile[]) => {
    setProfiles((prev) => {
      let changed = false
      const next = { ...prev }
      for (const p of list) {
        const old = prev[p.id]
        if (
          !old ||
          old.display_name !== p.display_name ||
          old.avatar_path !== p.avatar_path ||
          old.last_seen_at !== p.last_seen_at ||
          old.about !== p.about
        ) {
          next[p.id] = { ...old, ...p }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) return
    const { data, error: err } = await supabase.rpc('get_my_conversations')
    if (err) {
      setError(errorMessage(err))
    } else {
      const list = (data ?? []).map((row) => ({
        ...row,
        unread_count: Number(row.unread_count),
        member_count: Number(row.member_count),
      })) as unknown as ConversationSummary[]
      // Keep the open chat at zero unread: it is being read right now.
      setConversations(
        list.map((c) => (c.id === activeId.current && !document.hidden ? { ...c, unread_count: 0 } : c)),
      )
      rememberProfiles(list.flatMap((c) => (c.peer ? [c.peer] : [])))
      setError(null)
    }
    setLoading(false)
  }, [userId, rememberProfiles])

  // Debounced refresh for bursts of events.
  const refreshTimer = useRef<number | undefined>(undefined)
  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => void refresh(), 250)
  }, [refresh])

  const notify = useCallback(
    (message: Message) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      if (!document.hidden && activeId.current === message.conversation_id) return
      const conv = conversationsRef.current.find((c) => c.id === message.conversation_id)
      const sender = message.sender_id ? profilesRef.current[message.sender_id] : undefined
      const title =
        conv?.type === 'group'
          ? `${sender?.display_name ?? 'Someone'} · ${conv.title ?? 'Group'}`
          : (sender?.display_name ?? conversationTitle(conv) ?? 'New message')
      const body = message.body ?? (message.attachment_mime?.startsWith('image/') ? '📷 Photo' : '📎 File')
      try {
        const n = new Notification(title, {
          body,
          tag: message.conversation_id,
          icon: avatarUrl(sender?.avatar_path) ?? '/favicon.svg',
        })
        n.onclick = () => {
          window.focus()
          navigateRef.current(`/c/${message.conversation_id}`)
          n.close()
        }
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    },
    [],
  )

  const handleMessage = useCallback(
    (type: 'INSERT' | 'UPDATE', message: Message) => {
      const known = conversationsRef.current.some((c) => c.id === message.conversation_id)
      if (!known) {
        scheduleRefresh()
      } else {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === message.conversation_id)
          if (idx === -1) return prev
          const conv = prev[idx]
          const senderName = message.sender_id ? (profilesRef.current[message.sender_id]?.display_name ?? null) : null
          if (type === 'INSERT') {
            if (conv.last_message && conv.last_message.id === message.id) return prev
            const isActiveVisible = activeId.current === message.conversation_id && !document.hidden
            const fromOther = message.sender_id !== userId
            const updated: ConversationSummary = {
              ...conv,
              last_message_at: message.created_at,
              last_message: {
                id: message.id,
                body: message.body,
                sender_id: message.sender_id,
                sender_name: senderName,
                created_at: message.created_at,
                attachment_mime: message.attachment_mime,
                attachment_name: message.attachment_name,
                deleted_at: message.deleted_at,
              },
              unread_count: fromOther && !isActiveVisible ? conv.unread_count + 1 : conv.unread_count,
            }
            const rest = prev.filter((_, i) => i !== idx)
            return [updated, ...rest]
          }
          if (conv.last_message?.id !== message.id) return prev
          const next = [...prev]
          next[idx] = {
            ...conv,
            last_message: { ...conv.last_message, body: message.body, deleted_at: message.deleted_at },
          }
          return next
        })
      }
      if (type === 'INSERT' && message.sender_id !== userId) notify(message)
      messageListeners.current.forEach((l) => l(type, message))
    },
    [notify, scheduleRefresh, userId],
  )
  const handleMessageRef = useRef(handleMessage)
  handleMessageRef.current = handleMessage

  // One realtime channel per signed-in user. Every event is filtered by RLS on the server.
  useEffect(() => {
    if (!userId) return
    void refresh()
    let everSubscribed = false
    const channel: RealtimeChannel = supabase
      .channel(`user-changes:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) =>
        handleMessageRef.current('INSERT', p.new as Message),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) =>
        handleMessageRef.current('UPDATE', p.new as Message),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members' }, (p) => {
        const row = p.new as MemberRow
        if (row.user_id === userId) scheduleRefresh()
        else setConversations((prev) => prev.map((c) => (c.id === row.conversation_id ? { ...c, member_count: c.member_count + 1 } : c)))
        memberListeners.current.forEach((l) => l('INSERT', row))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, (p) => {
        const row = p.new as MemberRow
        if (row.user_id === userId) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== row.conversation_id) return c
              const readEverything = !c.last_message || new Date(row.last_read_at) >= new Date(c.last_message.created_at)
              return { ...c, my_role: row.role, last_read_at: row.last_read_at, unread_count: readEverything ? 0 : c.unread_count }
            }),
          )
        }
        memberListeners.current.forEach((l) => l('UPDATE', row))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (p) => {
        const row = p.new as { id: string; title: string | null; avatar_path: string | null }
        setConversations((prev) =>
          prev.map((c) => (c.id === row.id ? { ...c, title: row.title, avatar_path: row.avatar_path } : c)),
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const row = p.new as Profile
        rememberProfiles([row])
        setConversations((prev) => prev.map((c) => (c.peer?.id === row.id ? { ...c, peer: { ...c.peer, ...row } } : c)))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          // Catch up on anything missed while disconnected.
          if (everSubscribed) scheduleRefresh()
          everSubscribed = true
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false)
        }
      })

    const onVisible = () => {
      if (!document.hidden) scheduleRefresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', scheduleRefresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', scheduleRefresh)
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh, scheduleRefresh, rememberProfiles])

  const totalUnread = useMemo(() => conversations.reduce((sum, c) => sum + c.unread_count, 0), [conversations])

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Parley` : 'Parley'
  }, [totalUnread])

  const markReadTimers = useRef(new Map<string, number>())
  const markRead = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.some((c) => c.id === conversationId && c.unread_count !== 0)
        ? prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        : prev,
    )
    const timers = markReadTimers.current
    // Already scheduled: let the pending call go out instead of postponing it forever.
    if (timers.has(conversationId)) return
    window.clearTimeout(timers.get(conversationId))
    timers.set(
      conversationId,
      window.setTimeout(() => {
        timers.delete(conversationId)
        // Query builders are lazy: .then() is what actually sends the request.
        supabase
          .rpc('mark_conversation_read', { p_conversation_id: conversationId })
          .then(({ error: err }) => err && console.warn('mark_conversation_read failed', err.message))
      }, 400),
    )
  }, [])

  const setActiveConversation = useCallback((id: string | null) => {
    activeId.current = id
  }, [])

  const openDirectChat = useCallback(
    async (otherUserId: string) => {
      const { data, error: err } = await supabase.rpc('create_direct_conversation', { p_user_id: otherUserId })
      if (err) throw err
      await refresh()
      return data as string
    },
    [refresh],
  )

  const getConversation = useCallback((id: string) => conversations.find((c) => c.id === id), [conversations])

  const onMessage = useCallback((listener: MessageListener) => {
    messageListeners.current.add(listener)
    return () => {
      messageListeners.current.delete(listener)
    }
  }, [])

  const onMember = useCallback((listener: MemberListener) => {
    memberListeners.current.add(listener)
    return () => {
      memberListeners.current.delete(listener)
    }
  }, [])

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      loading,
      error,
      connected,
      totalUnread,
      refresh,
      getConversation,
      profiles,
      rememberProfiles,
      onMessage,
      onMember,
      setActiveConversation,
      markRead,
      openDirectChat,
    }),
    [
      conversations,
      loading,
      error,
      connected,
      totalUnread,
      refresh,
      getConversation,
      profiles,
      rememberProfiles,
      onMessage,
      onMember,
      setActiveConversation,
      markRead,
      openDirectChat,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>')
  return ctx
}
