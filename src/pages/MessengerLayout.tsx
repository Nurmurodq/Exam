import { Outlet, useMatch } from 'react-router-dom'
import Box from '@mui/material/Box'
import { ChatProvider } from '../contexts/ChatContext'
import { useHeartbeat } from '../hooks/usePresence'
import { Sidebar } from '../components/Sidebar'

export default function MessengerLayout() {
  const match = useMatch('/c/:conversationId')
  const activeId = match?.params.conversationId ?? null
  useHeartbeat(true)

  return (
    <ChatProvider>
      <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Box
          sx={{
            width: { xs: '100%', md: 360, lg: 400 },
            flexShrink: 0,
            display: { xs: activeId ? 'none' : 'block', md: 'block' },
          }}
        >
          <Sidebar activeId={activeId} />
        </Box>
        <Box
          component="main"
          sx={{ flex: 1, minWidth: 0, display: { xs: activeId ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column' }}
        >
          <Outlet />
        </Box>
      </Box>
    </ChatProvider>
  )
}
