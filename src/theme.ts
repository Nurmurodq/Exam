import { createTheme } from '@mui/material/styles'

declare module '@mui/material/styles' {
  interface Palette {
    chat: {
      own: string
      ownText: string
      other: string
      otherText: string
      wallpaper: string
      meta: string
      read: string
      sidebar: string
    }
  }
  interface PaletteOptions {
    chat?: Partial<Palette['chat']>
  }
}

const brand = '#4f6bed'

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand, contrastText: '#fff' },
        secondary: { main: '#14b8a6' },
        background: { default: '#f4f6fb', paper: '#ffffff' },
        chat: {
          own: '#dfe6ff',
          ownText: '#111827',
          other: '#ffffff',
          otherText: '#111827',
          wallpaper: '#e8edf6',
          meta: 'rgba(17, 24, 39, 0.5)',
          read: brand,
          sidebar: '#ffffff',
        },
      },
    },
    dark: {
      palette: {
        primary: { main: '#7b93ff', contrastText: '#0b1020' },
        secondary: { main: '#2dd4bf' },
        background: { default: '#0e131b', paper: '#161c26' },
        chat: {
          own: '#3647a3',
          ownText: '#f3f5ff',
          other: '#1f2633',
          otherText: '#e6e9ef',
          wallpaper: '#0b1017',
          meta: 'rgba(230, 233, 239, 0.55)',
          read: '#9fb2ff',
          sidebar: '#141a23',
        },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 16 } },
    },
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%' },
        body: { overscrollBehavior: 'none' },
        '*::-webkit-scrollbar': { width: 8, height: 8 },
        '*::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(127,127,127,0.35)', borderRadius: 8 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
      },
    },
  },
})
