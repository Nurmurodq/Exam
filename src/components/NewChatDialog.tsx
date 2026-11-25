import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import { useChat } from '../contexts/ChatContext'
import { PhoneLookup } from './PhoneLookup'
import { UserAvatar } from './UserAvatar'
import { formatPhone } from '../lib/phone'
import { errorMessage } from '../lib/errors'
import type { Profile } from '../lib/types'

interface NewChatDialogProps {
  open: boolean
  onClose: () => void
  onNewGroup: () => void
}

export function NewChatDialog({ open, onClose, onNewGroup }: NewChatDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const { conversations, openDirectChat } = useChat()
  const [found, setFound] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contacts = useMemo(
    () =>
      conversations
        .filter((c) => c.type === 'direct' && c.peer)
        .map((c) => ({ conversationId: c.id, profile: c.peer as Profile }))
        .sort((a, b) => a.profile.display_name.localeCompare(b.profile.display_name)),
    [conversations],
  )

  const close = () => {
    setFound(null)
    setError(null)
    onClose()
  }

  const startChat = async (profile: Profile) => {
    setBusy(true)
    setError(null)
    try {
      const id = await openDirectChat(profile.id)
      close()
      navigate(`/c/${id}`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Box sx={{ flex: 1 }}>New chat</Box>
        <IconButton onClick={close} aria-label="Close">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        <List disablePadding>
          <ListItemButton onClick={onNewGroup} sx={{ px: 3 }}>
            <ListItemAvatar>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              >
                <GroupAddRoundedIcon />
              </Box>
            </ListItemAvatar>
            <ListItemText primary="New group" secondary="Chat with several people at once" />
          </ListItemButton>
        </List>

        <Box sx={{ px: 3, pt: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Find by phone number
          </Typography>
          <Box sx={{ mt: 1 }}>
            <PhoneLookup onFound={setFound} buttonLabel="Search" />
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {found && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <UserAvatar id={found.id} name={found.display_name} path={found.avatar_path} size={52} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {found.display_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {formatPhone(found.phone)}
                  </Typography>
                  {found.about && (
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {found.about}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  startIcon={<ChatRoundedIcon />}
                  disabled={busy}
                  onClick={() => void startChat(found)}
                >
                  Message
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>

        {contacts.length > 0 && (
          <List
            sx={{ mt: 2 }}
            subheader={
              <ListSubheader sx={{ bgcolor: 'transparent', px: 3, lineHeight: '32px' }}>Recent contacts</ListSubheader>
            }
          >
            {contacts.map(({ conversationId, profile }) => (
              <ListItemButton
                key={profile.id}
                sx={{ px: 3 }}
                onClick={() => {
                  close()
                  navigate(`/c/${conversationId}`)
                }}
              >
                <ListItemAvatar>
                  <UserAvatar id={profile.id} name={profile.display_name} path={profile.avatar_path} size={40} />
                </ListItemAvatar>
                <ListItemText primary={profile.display_name} secondary={formatPhone(profile.phone)} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
