import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

export function ImageViewer({ image, onClose }: { image: { url: string; name: string } | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(image)}
      onClose={onClose}
      fullScreen
      slotProps={{ paper: { sx: { bgcolor: 'rgba(0,0,0,0.92)', borderRadius: 0 } } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 1, color: '#fff' }}>
        <Typography noWrap sx={{ flex: 1 }}>
          {image?.name}
        </Typography>
        <IconButton
          component="a"
          href={image?.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: '#fff' }}
          aria-label="Open original"
        >
          <OpenInNewRoundedIcon />
        </IconButton>
        <IconButton onClick={onClose} sx={{ color: '#fff' }} aria-label="Close image">
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 2, minHeight: 0 }} onClick={onClose}>
        {image && (
          <Box
            component="img"
            src={image.url}
            alt={image.name}
            onClick={(e) => e.stopPropagation()}
            sx={{ maxWidth: '100%', maxHeight: 'calc(100dvh - 96px)', objectFit: 'contain', borderRadius: 1 }}
          />
        )}
      </Box>
    </Dialog>
  )
}
