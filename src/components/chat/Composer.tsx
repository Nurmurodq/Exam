import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { useMediaQueryCoarsePointer } from '../../hooks/usePresence'
import { formatFileSize } from '../../lib/format'
import { MAX_ATTACHMENT_BYTES } from '../../lib/storage'
import type { ChatMessage } from '../../lib/types'

const MAX_LENGTH = 4000

interface ComposerProps {
  replyTo: ChatMessage | null
  replyToName: string
  onCancelReply: () => void
  editing: ChatMessage | null
  onCancelEdit: () => void
  file: File | null
  onFile: (file: File | null) => void
  onSend: (body: string, file: File | null) => Promise<void> | void
  onTyping: () => void
  onStopTyping: () => void
  onError: (message: string) => void
  disabled?: boolean
}

function snippet(m: ChatMessage) {
  if (m.body) return m.body
  if (m.attachment_mime?.startsWith('image/')) return '📷 Photo'
  return `📎 ${m.attachment_name ?? 'File'}`
}

export function Composer({
  replyTo,
  replyToName,
  onCancelReply,
  editing,
  onCancelEdit,
  file,
  onFile,
  onSend,
  onTyping,
  onStopTyping,
  onError,
  disabled,
}: ComposerProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const draftBeforeEdit = useRef('')
  const coarse = useMediaQueryCoarsePointer()

  useEffect(() => {
    if (editing) {
      draftBeforeEdit.current = text
      setText(editing.body ?? '')
      inputRef.current?.focus()
    } else {
      setText(draftBeforeEdit.current)
      draftBeforeEdit.current = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  useEffect(() => {
    if (replyTo) inputRef.current?.focus()
  }, [replyTo])

  const preview = useMemo(() => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const pickFile = (f: File | undefined | null) => {
    if (!f) return
    if (f.size > MAX_ATTACHMENT_BYTES) {
      onError('Files can be up to 20 MB.')
      return
    }
    onFile(f)
    inputRef.current?.focus()
  }

  const canSend = !disabled && (text.trim().length > 0 || (!editing && file !== null)) && text.length <= MAX_LENGTH

  const submit = () => {
    if (!canSend) return
    const body = text
    const attached = editing ? null : file
    setText('')
    onFile(null)
    onStopTyping()
    void onSend(body, attached)
    inputRef.current?.focus()
  }

  const bar = (icon: React.ReactNode, title: string, body: string, onClose: () => void) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, pt: 1, pb: 0.5 }}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0, borderLeft: '3px solid', borderColor: 'primary.main', pl: 1 }}>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'block' }} noWrap>
          {title}
        </Typography>
        <Typography variant="body2" noWrap color="text.secondary">
          {body}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onClose} aria-label="Cancel">
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  )

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: { xs: 1, sm: 2 }, pt: 0.5 }}>
      <Box sx={{ maxWidth: 920, mx: 'auto', display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <Paper
          elevation={0}
          sx={{ flex: 1, minWidth: 0, borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.12)', overflow: 'hidden' }}
        >
          {editing && bar(<EditRoundedIcon fontSize="small" />, 'Edit message', snippet(editing), onCancelEdit)}
          {!editing && replyTo && bar(<ReplyRoundedIcon fontSize="small" />, `Reply to ${replyToName}`, snippet(replyTo), onCancelReply)}
          {!editing && file && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, pt: 1 }}>
              {preview ? (
                <Box component="img" src={preview} alt="" sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1.5 }} />
              ) : (
                <Box
                  sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}
                >
                  <InsertDriveFileRoundedIcon color="action" />
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(file.size)} · add a caption or press send
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => onFile(null)} aria-label="Remove attachment">
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', px: 0.5, py: 0.5 }}>
            {!editing && (
              <Tooltip title="Attach file">
                <span>
                  <IconButton onClick={() => fileRef.current?.click()} disabled={disabled} aria-label="Attach file">
                    <AttachFileRoundedIcon sx={{ transform: 'rotate(45deg)' }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <InputBase
              inputRef={inputRef}
              multiline
              maxRows={6}
              fullWidth
              placeholder={disabled ? 'You can’t send messages here' : 'Message'}
              value={text}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value)
                if (e.target.value.trim()) onTyping()
                else onStopTyping()
              }}
              onBlur={onStopTyping}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submit()
                } else if (e.key === 'Escape') {
                  if (editing) onCancelEdit()
                  else if (replyTo) onCancelReply()
                } else if (e.key === 'ArrowUp' && !text && !editing) {
                  // Telegram-style: arrow up edits your last message (handled by parent via custom event).
                  window.dispatchEvent(new CustomEvent('parley:edit-last'))
                }
              }}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files)[0]
                if (pasted) {
                  e.preventDefault()
                  pickFile(pasted)
                }
              }}
              sx={{ px: 1, py: 1, fontSize: 15, lineHeight: 1.4 }}
              slotProps={{ input: { 'aria-label': 'Message', maxLength: MAX_LENGTH + 100 } }}
            />
          </Box>
          {text.length > MAX_LENGTH - 200 && (
            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'right', px: 2, pb: 0.5, color: text.length > MAX_LENGTH ? 'error.main' : 'text.secondary' }}
            >
              {text.length}/{MAX_LENGTH}
            </Typography>
          )}
        </Paper>
        <IconButton
          onClick={submit}
          disabled={!canSend}
          aria-label={editing ? 'Save edit' : 'Send message'}
          sx={{
            width: 48,
            height: 48,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'primary.main', color: 'primary.contrastText', opacity: 0.5 },
          }}
        >
          {editing ? <CheckRoundedIcon /> : <SendRoundedIcon />}
        </IconButton>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </Box>
    </Box>
  )
}
