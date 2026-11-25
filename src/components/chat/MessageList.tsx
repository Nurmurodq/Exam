import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Fab from '@mui/material/Fab'
import Typography from '@mui/material/Typography'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import { MessageBubble, type MessageAction, type Receipt } from './MessageBubble'
import { formatDayLabel, isSameDay } from '../../lib/format'
import type { ChatMessage, Profile } from '../../lib/types'

interface MessageListProps {
  messages: ChatMessage[]
  loading: boolean
  myId: string | null
  isGroup: boolean
  profiles: Record<string, Profile>
  /** Others have read everything up to this timestamp (blue ticks). */
  readUpTo: string | null
  /** Where the "Unread messages" divider goes (my last_read_at when the chat was opened). */
  unreadAfter: string | null
  hasMore: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onAction: (action: MessageAction, message: ChatMessage) => void
  onOpenImage: (url: string, name: string) => void
  typingLabel: string | null
}

const RUN_GAP_MS = 5 * 60 * 1000
const NEAR_BOTTOM_PX = 160

export function MessageList({
  messages,
  loading,
  myId,
  isGroup,
  profiles,
  readUpTo,
  unreadAfter,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onAction,
  onOpenImage,
  typingLabel,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinel = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const initialScrollDone = useRef(false)
  const prevFirstId = useRef<string | null>(null)
  const prevLastId = useRef<string | null>(null)
  const prevScrollHeight = useRef(0)
  const [showJump, setShowJump] = useState(false)
  const [newWhileAway, setNewWhileAway] = useState(0)

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  const firstUnreadId = useMemo(() => {
    if (!unreadAfter) return null
    return messages.find((m) => m.created_at > unreadAfter && m.sender_id !== myId && !m.status)?.id ?? null
  }, [messages, unreadAfter, myId])

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setNewWhileAway(0)
  }, [])

  // Remember scroll height before DOM updates so prepends keep position.
  const firstId = messages[0]?.id ?? null
  const lastId = messages[messages.length - 1]?.id ?? null
  if (scrollRef.current && (firstId !== prevFirstId.current || lastId !== prevLastId.current)) {
    prevScrollHeight.current = scrollRef.current.scrollHeight
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || loading) return

    if (!initialScrollDone.current) {
      initialScrollDone.current = true
      const divider = firstUnreadId ? document.getElementById('unread-divider') : null
      if (divider) el.scrollTop = Math.max(0, divider.offsetTop - 80)
      else el.scrollTop = el.scrollHeight
    } else if (firstId !== prevFirstId.current && lastId === prevLastId.current) {
      // Older messages were prepended: keep the viewport anchored.
      el.scrollTop += el.scrollHeight - prevScrollHeight.current
    } else if (lastId !== prevLastId.current) {
      const last = messages[messages.length - 1]
      if (last && (last.sender_id === myId || nearBottom.current)) {
        el.scrollTo({ top: el.scrollHeight, behavior: last.sender_id === myId ? 'auto' : 'smooth' })
      } else if (last) {
        setNewWhileAway((n) => n + 1)
      }
    }
    prevFirstId.current = firstId
    prevLastId.current = lastId
  }, [firstId, lastId, loading, messages, myId, firstUnreadId])

  // Keep pinned to bottom when the typing indicator appears or images load.
  useEffect(() => {
    if (nearBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [typingLabel])

  // Load older messages when the top sentinel scrolls into view.
  useEffect(() => {
    const el = topSentinel.current
    const root = scrollRef.current
    if (!el || !root || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && initialScrollDone.current) onLoadOlder()
      },
      { root, rootMargin: '400px 0px 0px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, onLoadOlder, loading])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    nearBottom.current = distance < NEAR_BOTTOM_PX
    setShowJump(distance > 400)
    if (nearBottom.current && newWhileAway) setNewWhileAway(0)
  }

  const jumpTo = useCallback((id: string) => {
    const node = document.getElementById(`msg-${id}`)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node.classList.add('flash')
    window.setTimeout(() => node.classList.remove('flash'), 1300)
  }, [])

  const senderName = useCallback(
    (id: string | null) => (id === myId ? 'You' : (id && profiles[id]?.display_name) || 'Unknown'),
    [myId, profiles],
  )

  const receiptFor = (m: ChatMessage): Receipt => {
    if (m.status) return m.status
    if (readUpTo && m.created_at <= readUpTo) return 'read'
    return 'sent'
  }

  const items: React.ReactNode[] = []
  messages.forEach((m, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const newDay = !prev || !isSameDay(prev.created_at, m.created_at)
    if (newDay) {
      items.push(
        <Box key={`day-${m.created_at}`} sx={{ display: 'flex', justifyContent: 'center', my: 1.5, position: 'sticky', top: 8, zIndex: 1 }}>
          <Chip
            size="small"
            label={formatDayLabel(m.created_at)}
            sx={{ bgcolor: 'background.paper', boxShadow: 1, fontWeight: 600, opacity: 0.95 }}
          />
        </Box>,
      )
    }
    if (m.id === firstUnreadId) {
      items.push(
        <Box
          key="unread-divider"
          id="unread-divider"
          sx={{ my: 1.5, py: 0.5, textAlign: 'center', bgcolor: 'action.hover', color: 'text.secondary' }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Unread messages
          </Typography>
        </Box>,
      )
    }
    const sameRunAsPrev =
      !newDay &&
      prev &&
      prev.sender_id === m.sender_id &&
      m.id !== firstUnreadId &&
      new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < RUN_GAP_MS
    const sameRunAsNext =
      next &&
      next.sender_id === m.sender_id &&
      isSameDay(next.created_at, m.created_at) &&
      next.id !== firstUnreadId &&
      new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < RUN_GAP_MS

    items.push(
      <MessageBubble
        key={m.id}
        message={m}
        isOwn={m.sender_id === myId}
        isGroup={isGroup}
        sender={m.sender_id ? profiles[m.sender_id] : undefined}
        firstInRun={!sameRunAsPrev}
        lastInRun={!sameRunAsNext}
        receipt={receiptFor(m)}
        replyTarget={m.reply_to_id ? byId.get(m.reply_to_id) : undefined}
        replySenderName={senderName}
        onAction={onAction}
        onOpenImage={onOpenImage}
        onJumpTo={jumpTo}
      />,
    )
  })

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <Box
        ref={scrollRef}
        onScroll={onScroll}
        data-testid="message-list"
        role="log"
        aria-live="polite"
        aria-label="Messages"
        sx={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', pb: 1.5 }}
      >
        <Box sx={{ maxWidth: 920, mx: 'auto' }}>
          <div ref={topSentinel} style={{ height: 1 }} />
          {loadingOlder && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={22} />
            </Box>
          )}
          {!hasMore && !loading && messages.length > 0 && (
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', py: 2 }}>
              This is the beginning of the conversation
            </Typography>
          )}
          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress size={28} />
            </Box>
          ) : messages.length === 0 ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 10, px: 3 }}>
              <Box sx={{ bgcolor: 'background.paper', px: 3, py: 2, borderRadius: 3, textAlign: 'center', boxShadow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>No messages here yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Send a message to start the conversation 👋
                </Typography>
              </Box>
            </Box>
          ) : (
            items
          )}
          {typingLabel && (
            <Box sx={{ px: { xs: 1, sm: 2 }, mt: 1 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'chat.other',
                  color: 'text.secondary',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 4,
                  fontSize: 13,
                  boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                }}
              >
                <TypingDots />
                {typingLabel}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {(showJump || newWhileAway > 0) && (
        <Fab
          size="small"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest messages"
          sx={{ position: 'absolute', right: 16, bottom: 16, bgcolor: 'background.paper', color: 'text.primary' }}
        >
          <Badge badgeContent={newWhileAway} color="primary">
            <KeyboardArrowDownRoundedIcon />
          </Badge>
        </Fab>
      )}
    </Box>
  )
}

function TypingDots() {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        gap: '3px',
        '& span': {
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          animation: 'parley-bounce 1.2s infinite ease-in-out',
        },
        '& span:nth-of-type(2)': { animationDelay: '0.15s' },
        '& span:nth-of-type(3)': { animationDelay: '0.3s' },
        '@keyframes parley-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.5 },
          '30%': { transform: 'translateY(-4px)', opacity: 1 },
        },
      }}
    >
      <span />
      <span />
      <span />
    </Box>
  )
}
