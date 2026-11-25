import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { UserAvatar } from '../UserAvatar'
import { AttachmentFile, AttachmentImage } from './Attachment'
import { isImage } from '../../hooks/useSignedUrl'
import { fetchMessageById } from '../../hooks/useMessages'
import { colorForId, formatTime } from '../../lib/format'
import type { ChatMessage, Message, Profile } from '../../lib/types'

export type MessageAction = 'reply' | 'copy' | 'edit' | 'delete' | 'retry' | 'discard'
export type Receipt = 'sending' | 'failed' | 'sent' | 'read'

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  isGroup: boolean
  sender: Profile | undefined
  firstInRun: boolean
  lastInRun: boolean
  receipt: Receipt
  replyTarget: Message | undefined
  replySenderName: (senderId: string | null) => string
  onAction: (action: MessageAction, message: ChatMessage) => void
  onOpenImage: (url: string, name: string) => void
  onJumpTo: (messageId: string) => void
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g
const EMOJI_ONLY_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,24}$/u

function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <Link key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" sx={{ color: 'inherit', wordBreak: 'break-all' }}>
        {part}
      </Link>
    ) : (
      part
    ),
  )
}

function ReceiptIcon({ receipt }: { receipt: Receipt }) {
  const sx = { fontSize: 16, ml: 0.25 }
  if (receipt === 'sending') return <AccessTimeRoundedIcon sx={sx} aria-label="Sending" />
  if (receipt === 'failed') return <ErrorRoundedIcon sx={{ ...sx, color: 'error.main' }} aria-label="Failed to send" />
  if (receipt === 'read') return <DoneAllRoundedIcon sx={{ ...sx, color: 'chat.read' }} aria-label="Read" />
  return <DoneRoundedIcon sx={sx} aria-label="Sent" />
}

function ReplyQuote({
  replyToId,
  target,
  senderName,
  onJump,
}: {
  replyToId: string
  target: Message | undefined
  senderName: (id: string | null) => string
  onJump: (id: string) => void
}) {
  const [fetched, setFetched] = useState<Message | null | undefined>(undefined)
  useEffect(() => {
    if (target) return
    let cancelled = false
    void fetchMessageById(replyToId).then((m) => !cancelled && setFetched(m))
    return () => {
      cancelled = true
    }
  }, [replyToId, target])
  const m = target ?? fetched
  const color = colorForId(m?.sender_id)
  const text = !m
    ? fetched === null
      ? 'Message unavailable'
      : 'Loading…'
    : m.deleted_at
      ? 'Deleted message'
      : (m.body ?? (m.attachment_mime?.startsWith('image/') ? '📷 Photo' : `📎 ${m.attachment_name ?? 'File'}`))

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        if (m) onJump(m.id)
      }}
      onKeyDown={(e) => e.key === 'Enter' && m && onJump(m.id)}
      sx={{
        borderLeft: '3px solid',
        borderColor: color,
        bgcolor: 'action.hover',
        borderRadius: 1,
        px: 1,
        py: 0.5,
        mb: 0.5,
        cursor: m ? 'pointer' : 'default',
        maxWidth: '100%',
      }}
    >
      <Typography variant="caption" sx={{ color, fontWeight: 700, display: 'block' }} noWrap>
        {m ? senderName(m.sender_id) : ' '}
      </Typography>
      <Typography variant="body2" noWrap sx={{ opacity: 0.8 }}>
        {text}
      </Typography>
    </Box>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message: m,
  isOwn,
  isGroup,
  sender,
  firstInRun,
  lastInRun,
  receipt,
  replyTarget,
  replySenderName,
  onAction,
  onOpenImage,
  onJumpTo,
}: MessageBubbleProps) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)
  const longPress = useRef<number | undefined>(undefined)
  const deleted = Boolean(m.deleted_at)
  const hasImage = !deleted && Boolean(m.attachment_path) && isImage(m)
  const hasFile = !deleted && Boolean(m.attachment_path) && !isImage(m)
  const imageOnly = hasImage && !m.body
  const emojiOnly = !deleted && !m.attachment_path && Boolean(m.body) && EMOJI_ONLY_RE.test(m.body ?? '')
  const showName = isGroup && !isOwn && firstInRun
  const senderColor = colorForId(m.sender_id)

  const openMenu = (x: number, y: number) => {
    if (deleted && !m.status) return
    setMenu({ top: y, left: x })
  }

  // Consecutive messages from one sender hug each other; the last one gets a "tail" corner.
  const radius = 18
  const tight = 6
  const tail = 4
  const borderRadius = isOwn
    ? `${radius}px ${firstInRun ? radius : tight}px ${lastInRun ? tail : tight}px ${radius}px`
    : `${firstInRun ? radius : tight}px ${radius}px ${radius}px ${lastInRun ? tail : tight}px`

  const meta = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        fontSize: 11.5,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: imageOnly ? '#fff' : 'chat.meta',
        ...(imageOnly
          ? { position: 'absolute', right: 8, bottom: 8, bgcolor: 'rgba(0,0,0,0.45)', px: 0.75, py: 0.4, borderRadius: 999 }
          : { float: 'right', position: 'relative', top: 6, ml: 1.25, mt: '-2px' }),
      }}
    >
      {m.edited_at && !deleted && <span>edited</span>}
      <span>{formatTime(m.created_at)}</span>
      {isOwn && !deleted && <ReceiptIcon receipt={receipt} />}
    </Box>
  )

  return (
    <Box
      id={`msg-${m.id}`}
      data-testid="message"
      data-own={isOwn ? 'true' : 'false'}
      sx={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: 1,
        mt: firstInRun ? 1 : 0.25,
        px: { xs: 1, sm: 2 },
        '&:hover .msg-more': { opacity: 1 },
        '&.flash .msg-bubble': { animation: 'parley-flash 1.2s ease' },
        '@keyframes parley-flash': {
          '0%, 100%': { filter: 'none' },
          '30%': { filter: 'brightness(0.85)' },
        },
      }}
    >
      {isGroup && !isOwn && (
        <Box sx={{ width: 34, flexShrink: 0 }}>
          {lastInRun && <UserAvatar id={m.sender_id} name={sender?.display_name} path={sender?.avatar_path} size={34} />}
        </Box>
      )}

      <Box
        className="msg-bubble"
        onContextMenu={(e) => {
          e.preventDefault()
          openMenu(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          longPress.current = window.setTimeout(() => openMenu(t.clientX, t.clientY), 450)
        }}
        onTouchEnd={() => window.clearTimeout(longPress.current)}
        onTouchMove={() => window.clearTimeout(longPress.current)}
        sx={{
          position: 'relative',
          maxWidth: { xs: '85%', sm: '70%', lg: '60%' },
          minWidth: 0,
          bgcolor: emojiOnly ? 'transparent' : isOwn ? 'chat.own' : 'chat.other',
          color: isOwn ? 'chat.ownText' : 'chat.otherText',
          borderRadius,
          px: emojiOnly ? 0 : imageOnly ? 0.5 : 1.25,
          pt: emojiOnly ? 0 : imageOnly ? 0.5 : 0.75,
          pb: emojiOnly ? 0 : imageOnly ? 0.5 : 0.75,
          boxShadow: emojiOnly ? 'none' : '0 1px 1px rgba(0,0,0,0.08)',
          opacity: m.status === 'sending' ? 0.85 : 1,
          userSelect: 'text',
          WebkitTouchCallout: 'none',
        }}
      >
        {showName && (
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: senderColor, mb: 0.25, px: imageOnly ? 0.75 : 0 }}>
            {sender?.display_name ?? 'Unknown'}
          </Typography>
        )}

        {m.reply_to_id && !deleted && (
          <ReplyQuote replyToId={m.reply_to_id} target={replyTarget} senderName={replySenderName} onJump={onJumpTo} />
        )}

        {hasImage && (
          <AttachmentImage message={m} onOpen={onOpenImage}>
            {imageOnly && meta}
          </AttachmentImage>
        )}
        {hasFile && <AttachmentFile message={m} />}

        {deleted ? (
          <Typography
            variant="body2"
            sx={{ fontStyle: 'italic', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}
          >
            <BlockRoundedIcon sx={{ fontSize: 16 }} />
            {isOwn ? 'You deleted this message' : 'This message was deleted'}
            <Box component="span" sx={{ flex: 1 }} />
            {meta}
          </Typography>
        ) : m.body ? (
          <Typography
            component="div"
            sx={{
              fontSize: emojiOnly ? 40 : 15,
              lineHeight: emojiOnly ? 1.2 : 1.4,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              mt: hasImage || hasFile ? 0.75 : 0,
              px: imageOnly ? 0.75 : 0,
            }}
          >
            {linkify(m.body)}
            {!imageOnly && meta}
          </Typography>
        ) : (
          !imageOnly && <Box sx={{ textAlign: 'right', mt: 0.5, minHeight: 12 }}>{meta}</Box>
        )}

        {!deleted && !m.status && (
          <IconButton
            className="msg-more"
            size="small"
            aria-label="Message actions"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              openMenu(r.left, r.bottom)
            }}
            sx={{
              position: 'absolute',
              top: 2,
              right: 2,
              opacity: 0,
              transition: 'opacity .15s',
              bgcolor: isOwn ? 'chat.own' : 'chat.other',
              '&:hover': { bgcolor: isOwn ? 'chat.own' : 'chat.other' },
              p: 0.25,
              '@media (hover: none)': { display: 'none' },
            }}
          >
            <ExpandMoreRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Menu
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ?? undefined}
      >
        {m.status === 'failed'
          ? [
              <MenuItem key="retry" onClick={() => (setMenu(null), onAction('retry', m))}>
                <ListItemIcon>
                  <RefreshRoundedIcon fontSize="small" />
                </ListItemIcon>
                Retry
              </MenuItem>,
              <MenuItem key="discard" onClick={() => (setMenu(null), onAction('discard', m))}>
                <ListItemIcon>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </ListItemIcon>
                Discard
              </MenuItem>,
            ]
          : [
              <MenuItem key="reply" onClick={() => (setMenu(null), onAction('reply', m))}>
                <ListItemIcon>
                  <ReplyRoundedIcon fontSize="small" />
                </ListItemIcon>
                Reply
              </MenuItem>,
              m.body && (
                <MenuItem key="copy" onClick={() => (setMenu(null), onAction('copy', m))}>
                  <ListItemIcon>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Copy text
                </MenuItem>
              ),
              isOwn && (m.body || !m.attachment_path) && (
                <MenuItem key="edit" onClick={() => (setMenu(null), onAction('edit', m))}>
                  <ListItemIcon>
                    <EditRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Edit
                </MenuItem>
              ),
              isOwn && (
                <MenuItem key="delete" onClick={() => (setMenu(null), onAction('delete', m))} sx={{ color: 'error.main' }}>
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  Delete
                </MenuItem>
              ),
            ]}
      </Menu>
    </Box>
  )
})
