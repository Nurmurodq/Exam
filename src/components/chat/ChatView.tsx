import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import { useAuth } from '../../contexts/AuthContext'
import { useChat } from '../../contexts/ChatContext'
import { useMessages } from '../../hooks/useMessages'
import { useMembers } from '../../hooks/useMembers'
import { useTyping } from '../../hooks/useTyping'
import { useNow } from '../../hooks/usePresence'
import { errorMessage } from '../../lib/errors'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { ChatInfoDrawer } from './ChatInfoDrawer'
import { ImageViewer } from './ImageViewer'
import { wallpaperSx } from '../wallpaper'
import type { MessageAction } from './MessageBubble'
import type { ChatMessage } from '../../lib/types'

export function ChatRoute() {
  const { conversationId } = useParams<{ conversationId: string }>()
  if (!conversationId) return null
  return <ChatView key={conversationId} conversationId={conversationId} />
}

function ChatView({ conversationId }: { conversationId: string }) {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { getConversation, loading: listLoading, setActiveConversation, markRead, refresh, profiles } = useChat()
  const conversation = getConversation(conversationId)
  const { messages, loading, loadingOlder, hasMore, loadOlder, send, retry, discard, edit, remove } =
    useMessages(conversationId)
  const { members, reload: reloadMembers } = useMembers(conversationId)
  const { typingUserIds, notifyTyping, notifyStopped } = useTyping(conversationId, userId)
  const now = useNow(15_000)

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [image, setImage] = useState<{ url: string; name: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  // Where to draw the "Unread messages" divider: captured once when the chat opens.
  const unreadAfter = useRef<string | null | undefined>(undefined)
  if (unreadAfter.current === undefined && conversation) {
    unreadAfter.current = conversation.unread_count > 0 ? conversation.last_read_at : null
  }

  useEffect(() => {
    setActiveConversation(conversationId)
    return () => setActiveConversation(null)
  }, [conversationId, setActiveConversation])

  // Mark as read while the chat is open and visible.
  const me = members.find((m) => m.user_id === userId)
  const lastFromOthers = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id !== userId && !messages[i].status) return messages[i]
    }
    return undefined
  }, [messages, userId])

  const unreadCount = conversation?.unread_count ?? 0
  const hasConversation = Boolean(conversation)
  const myLastRead = me?.last_read_at ?? null
  const lastFromOthersAt = lastFromOthers?.created_at ?? null
  useEffect(() => {
    const check = () => {
      if (document.hidden || !hasConversation) return
      const behind = lastFromOthersAt !== null && myLastRead !== null && lastFromOthersAt > myLastRead
      if (unreadCount > 0 || behind) markRead(conversationId)
    }
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [hasConversation, conversationId, lastFromOthersAt, markRead, myLastRead, unreadCount])

  // Blue ticks: everyone else has read up to the *earliest* of their read positions.
  const readUpTo = useMemo(() => {
    const others = members.filter((m) => m.user_id !== userId)
    if (others.length === 0) return null
    return others.reduce((min, m) => (m.last_read_at < min ? m.last_read_at : min), others[0].last_read_at)
  }, [members, userId])

  const typingLabel = useMemo(() => {
    const names = typingUserIds.map((id) => profiles[id]?.display_name ?? 'Someone')
    if (names.length === 0) return null
    if (conversation?.type === 'direct') return 'typing…'
    if (names.length === 1) return `${names[0]} is typing…`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
    return `${names.length} people are typing…`
  }, [typingUserIds, profiles, conversation?.type])

  const senderName = useCallback(
    (id: string | null) => (id === userId ? 'yourself' : (id && profiles[id]?.display_name) || 'Unknown'),
    [profiles, userId],
  )

  const handleSendError = useCallback(
    (e: unknown) => {
      const msg = errorMessage(e)
      if (/row-level security|permission denied/i.test(msg)) {
        setToast('You can no longer send messages in this chat.')
        void refresh()
      } else {
        setToast(`Message not sent: ${msg}. Right-click or long-press it to retry.`)
      }
    },
    [refresh],
  )

  const onSend = useCallback(
    async (body: string, attached: File | null) => {
      try {
        if (editing) {
          const target = editing
          setEditing(null)
          if (body.trim() !== (target.body ?? '')) await edit(target.id, body)
          return
        }
        const reply = replyTo
        setReplyTo(null)
        await send({ body, file: attached, replyToId: reply?.id ?? null })
      } catch (e) {
        handleSendError(e)
      }
    },
    [edit, editing, handleSendError, replyTo, send],
  )

  const onAction = useCallback(
    (action: MessageAction, m: ChatMessage) => {
      switch (action) {
        case 'reply':
          setEditing(null)
          setReplyTo(m)
          break
        case 'copy':
          void navigator.clipboard?.writeText(m.body ?? '').then(() => setToast('Copied to clipboard'))
          break
        case 'edit':
          setReplyTo(null)
          setEditing(m)
          break
        case 'delete':
          setConfirmDelete(m)
          break
        case 'retry':
          void retry(m.id).catch(handleSendError)
          break
        case 'discard':
          discard(m.id)
          break
      }
    },
    [discard, handleSendError, retry],
  )

  // Arrow-up in an empty composer edits your last text message.
  useEffect(() => {
    const handler = () => {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.sender_id === userId && !m.deleted_at && !m.status && m.body) {
          setReplyTo(null)
          setEditing(m)
          return
        }
      }
    }
    window.addEventListener('parley:edit-last', handler)
    return () => window.removeEventListener('parley:edit-last', handler)
  }, [messages, userId])

  const openImage = useCallback((url: string, name: string) => setImage({ url, name }), [])

  if (!conversation) {
    return (
      <Box sx={{ ...wallpaperSx, flex: 1, display: 'grid', placeItems: 'center' }}>
        {listLoading ? (
          <CircularProgress />
        ) : (
          <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', p: 3 }}>
            <Typography variant="h6">Chat not found</Typography>
            <Typography color="text.secondary">It may have been deleted, or you are no longer a member.</Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
              Back to chats
            </Button>
          </Stack>
        )}
      </Box>
    )
  }

  return (
    <Box
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', position: 'relative' }}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        const dropped = e.dataTransfer.files?.[0]
        if (dropped) {
          setEditing(null)
          setFile(dropped)
        }
      }}
    >
      <ChatHeader
        conversation={conversation}
        members={members}
        myId={userId}
        typingLabel={typingLabel}
        now={now}
        onBack={() => navigate('/')}
        onOpenInfo={() => setInfoOpen(true)}
      />
      <Box sx={{ ...wallpaperSx, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <MessageList
          messages={messages}
          loading={loading}
          myId={userId}
          isGroup={conversation.type === 'group'}
          profiles={profiles}
          readUpTo={readUpTo}
          unreadAfter={unreadAfter.current ?? null}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={() => void loadOlder()}
          onAction={onAction}
          onOpenImage={openImage}
          typingLabel={typingLabel}
        />
        <Composer
          replyTo={replyTo}
          replyToName={replyTo ? senderName(replyTo.sender_id) : ''}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          file={file}
          onFile={setFile}
          onSend={onSend}
          onTyping={notifyTyping}
          onStopTyping={notifyStopped}
          onError={setToast}
        />
      </Box>

      {dragging && (
        <Box
          sx={{
            position: 'absolute',
            inset: 8,
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 4,
            bgcolor: 'background.paper',
            opacity: 0.95,
            display: 'grid',
            placeItems: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Stack spacing={1} sx={{ alignItems: 'center', color: 'primary.main' }}>
            <CloudUploadRoundedIcon sx={{ fontSize: 48 }} />
            <Typography sx={{ fontWeight: 600 }}>Drop a file to send</Typography>
          </Stack>
        </Box>
      )}

      <ChatInfoDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        conversation={conversation}
        members={members}
        reloadMembers={reloadMembers}
        now={now}
      />
      <ImageViewer image={image} onClose={() => setImage(null)} />

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete message?</DialogTitle>
        <DialogContent>
          <DialogContentText>It will be deleted for everyone in this chat.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const m = confirmDelete
              setConfirmDelete(null)
              if (m) void remove(m.id).catch((e) => setToast(errorMessage(e)))
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  )
}
