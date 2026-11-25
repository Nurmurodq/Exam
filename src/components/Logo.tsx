import Box from '@mui/material/Box'

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      sx={{ width: size, height: size, display: 'block', flexShrink: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="parley-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d84ff" />
          <stop offset="1" stopColor="#3f5bd8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#parley-g)" />
      <path
        d="M14 15.5c0-1.9 1.6-3.5 3.5-3.5h13c1.9 0 3.5 1.6 3.5 3.5v10c0 1.9-1.6 3.5-3.5 3.5h-7.2l-5.6 4.6c-.7.5-1.7 0-1.7-.8V29h-.5c-1.9 0-3.5-1.6-3.5-3.5z"
        fill="#fff"
      />
      <circle cx="19.5" cy="20.5" r="1.8" fill="#4f6bed" />
      <circle cx="24" cy="20.5" r="1.8" fill="#4f6bed" />
      <circle cx="28.5" cy="20.5" r="1.8" fill="#4f6bed" />
    </Box>
  )
}
