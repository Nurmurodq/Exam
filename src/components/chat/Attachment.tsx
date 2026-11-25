import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import BrokenImageRoundedIcon from '@mui/icons-material/BrokenImageRounded'
import { supabase } from '../../lib/supabase'
import { formatFileSize } from '../../lib/format'
import { useSignedUrl } from '../../hooks/useSignedUrl'
import type { ChatMessage } from '../../lib/types'

export function AttachmentImage({
  message,
  onOpen,
  children,
}: {
  message: ChatMessage
  onOpen: (url: string, name: string) => void
  children?: React.ReactNode
}) {
  const { url: signed, failed } = useSignedUrl(message.attachment_path, Boolean(message.status))
  const [loaded, setLoaded] = useState(false)
  const src = signed ?? message.localPreviewUrl ?? null

  return (
    <ButtonBase
      onClick={() => src && onOpen(signed ?? src, message.attachment_name ?? 'image')}
      sx={{
        position: 'relative',
        display: 'block',
        borderRadius: 2,
        overflow: 'hidden',
        width: { xs: 240, sm: 300 },
        maxWidth: '100%',
        minHeight: 120,
        bgcolor: 'action.hover',
      }}
      aria-label={`Open image ${message.attachment_name ?? ''}`}
    >
      {failed && !src ? (
        <Box sx={{ height: 160, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
          <BrokenImageRoundedIcon />
        </Box>
      ) : (
        <>
          {!loaded && <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, height: '100%' }} />}
          {src && (
            <Box
              component="img"
              src={src}
              alt={message.attachment_name ?? 'Image'}
              onLoad={() => setLoaded(true)}
              draggable={false}
              sx={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }}
            />
          )}
        </>
      )}
      {message.status === 'sending' && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.25)' }}>
          <CircularProgress size={36} sx={{ color: '#fff' }} />
        </Box>
      )}
      {children}
    </ButtonBase>
  )
}

export function AttachmentFile({ message }: { message: ChatMessage }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    if (!message.attachment_path || message.status) return
    setBusy(true)
    const { data } = await supabase.storage
      .from('attachments')
      .createSignedUrl(message.attachment_path, 60, { download: message.attachment_name ?? true })
    setBusy(false)
    if (data?.signedUrl) window.location.assign(data.signedUrl)
  }

  return (
    <ButtonBase
      onClick={() => void download()}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1,
        pr: 2,
        borderRadius: 2,
        bgcolor: 'action.hover',
        textAlign: 'left',
        maxWidth: 300,
        width: '100%',
      }}
      aria-label={`Download ${message.attachment_name ?? 'file'}`}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {busy || message.status === 'sending' ? (
          <CircularProgress size={20} color="inherit" />
        ) : message.status ? (
          <InsertDriveFileRoundedIcon />
        ) : (
          <DownloadRoundedIcon />
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {message.attachment_name ?? 'File'}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {formatFileSize(message.attachment_size)}
        </Typography>
      </Box>
    </ButtonBase>
  )
}
