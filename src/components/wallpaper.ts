import type { SxProps, Theme } from '@mui/material/styles'

// Subtle dotted pattern behind conversations, in both colour schemes.
export const wallpaperSx: SxProps<Theme> = (theme) => ({
  backgroundColor: theme.vars?.palette.chat.wallpaper,
  backgroundImage: `radial-gradient(rgba(${theme.vars?.palette.primary.mainChannel} / 0.10) 1px, transparent 1px)`,
  backgroundSize: '18px 18px',
})
