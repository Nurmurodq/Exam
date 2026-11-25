import { useEffect, useMemo, useRef } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { avatarUrl } from '../lib/storage'
import { colorForId, initials } from '../lib/format'

interface AvatarPickerProps {
  id: string | null | undefined
  name: string
  /** Newly chosen file (preview), takes precedence over `path`. */
  file: File | null
  onFile: (file: File | null) => void
  path?: string | null
  onRemove?: () => void
  size?: number
  disabled?: boolean
}

export function AvatarPicker({ id, name, file, onFile, path, onRemove, size = 96, disabled }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const src = preview ?? avatarUrl(path)

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <Avatar
        src={src}
        sx={{ width: size, height: size, fontSize: size * 0.36, fontWeight: 600, bgcolor: colorForId(id), color: '#fff' }}
      >
        {initials(name)}
      </Avatar>
      <Tooltip title="Choose photo">
        <span style={{ position: 'absolute', right: -4, bottom: -4 }}>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            aria-label="Choose photo"
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              border: '3px solid',
              borderColor: 'background.paper',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <PhotoCameraRoundedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {(file || (path && onRemove)) && (
        <Tooltip title="Remove photo">
          <span style={{ position: 'absolute', left: -4, bottom: -4 }}>
            <IconButton
              size="small"
              disabled={disabled}
              aria-label="Remove photo"
              onClick={() => (file ? onFile(null) : onRemove?.())}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </Box>
  )
}
