import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import { useAuth } from '../contexts/AuthContext'
import { conversationTitle } from '../lib/conversation'
import { useChat } from '../contexts/ChatContext'
import { useNow } from '../hooks/usePresence'
import { ChatListItem } from './ChatListItem'
import { UserAvatar } from './UserAvatar'
import { NewChatDialog } from './NewChatDialog'
import { NewGroupDialog } from './NewGroupDialog'
import { ProfileDrawer } from './ProfileDrawer'
import { LogoMark } from './Logo'

export function Sidebar({ activeId }: { activeId: string | null }) {
  const { profile, userId, signOut } = useAuth()
  const { conversations, loading, error, connected, refresh } = useChat()
  const navigate = useNavigate()
  const now = useNow(30_000)
  const [query, setQuery] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    const digits = q.replace(/\D/g, '')
    return conversations.filter(
      (c) =>
        conversationTitle(c).toLowerCase().includes(q) ||
        (digits.length >= 3 && (c.peer?.phone ?? '').replace(/\D/g, '').includes(digits)) ||
        (c.last_message?.body ?? '').toLowerCase().includes(q),
    )
  }, [conversations, query])

  return (
    <Box
      component="nav"
      aria-label="Chats"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'chat.sidebar',
        borderRight: { md: '1px solid' },
        borderColor: { md: 'divider' },
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, pt: 1.5, pb: 1 }}>
        <Tooltip title="Profile & settings">
          <IconButton onClick={() => setProfileOpen(true)} sx={{ p: 0.25 }} aria-label="Open profile">
            <UserAvatar id={userId} name={profile?.display_name} path={profile?.avatar_path} size={38} />
          </IconButton>
        </Tooltip>
        <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
          <LogoMark size={22} />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.3 }}>
            Parley
          </Typography>
        </Stack>
        <Tooltip title="New chat">
          <IconButton
            onClick={() => setNewChatOpen(true)}
            aria-label="New chat"
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            <EditRoundedIcon />
          </IconButton>
        </Tooltip>
        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="Menu">
          <MoreVertRoundedIcon />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null)
              setNewChatOpen(true)
            }}
          >
            <ListItemIcon>
              <PersonAddAlt1RoundedIcon fontSize="small" />
            </ListItemIcon>
            New chat
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null)
              setNewGroupOpen(true)
            }}
          >
            <ListItemIcon>
              <GroupAddRoundedIcon fontSize="small" />
            </ListItemIcon>
            New group
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null)
              setProfileOpen(true)
            }}
          >
            <ListItemIcon>
              <SettingsRoundedIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setMenuAnchor(null)
              void signOut()
            }}
          >
            <ListItemIcon>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Stack>

      {/* Search */}
      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              sx: { borderRadius: 999, bgcolor: 'action.hover', '& fieldset': { border: 'none' } },
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuery('')} aria-label="Clear search">
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
            htmlInput: { 'aria-label': 'Search chats' },
          }}
        />
      </Box>

      {!connected && !loading && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Connecting…
          </Typography>
          <LinearProgress sx={{ borderRadius: 1, mt: 0.5 }} />
        </Box>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mx: 2, mb: 1 }}
          action={
            <Button color="inherit" size="small" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', pb: 10 }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : conversations.length === 0 ? (
          <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', px: 4, py: 8, color: 'text.secondary' }}>
            <ForumRoundedIcon sx={{ fontSize: 56, opacity: 0.4 }} />
            <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 600 }}>
              No chats yet
            </Typography>
            <Typography variant="body2">Find someone by their phone number to start a conversation.</Typography>
            <Button variant="contained" onClick={() => setNewChatOpen(true)} startIcon={<PersonAddAlt1RoundedIcon />}>
              Start a chat
            </Button>
          </Stack>
        ) : filtered.length === 0 ? (
          <Typography sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }} variant="body2">
            No chats match “{query}”
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map((c) => (
              <ChatListItem
                key={c.id}
                conversation={c}
                selected={c.id === activeId}
                myId={userId}
                now={now}
                onClick={() => navigate(`/c/${c.id}`)}
              />
            ))}
          </List>
        )}
      </Box>

      <Fab
        color="primary"
        aria-label="New chat"
        onClick={() => setNewChatOpen(true)}
        sx={{ position: 'absolute', right: 20, bottom: 20, display: { xs: 'flex', md: 'none' } }}
      >
        <EditRoundedIcon />
      </Fab>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onNewGroup={() => {
          setNewChatOpen(false)
          setNewGroupOpen(true)
        }}
      />
      <NewGroupDialog open={newGroupOpen} onClose={() => setNewGroupOpen(false)} />
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </Box>
  )
}
