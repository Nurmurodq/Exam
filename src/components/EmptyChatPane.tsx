import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { LogoMark } from './Logo'
import { wallpaperSx } from './wallpaper'

export function EmptyChatPane() {
  return (
    <Box sx={{ ...wallpaperSx, flex: 1, display: 'grid', placeItems: 'center', p: 4 }}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 380 }}>
        <LogoMark size={72} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Parley for Web
        </Typography>
        <Typography color="text.secondary">
          Pick a chat on the left, or start a new one with anyone who has a Parley account — all you need is their phone
          number.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary', pt: 2 }}>
          <LockRoundedIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption">Chats are only visible to their members.</Typography>
        </Stack>
      </Stack>
    </Box>
  )
}
