import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { conversationTitle } from '../../lib/conversation'
import { useChat } from '../../contexts/ChatContext'
import { AvatarPicker } from '../AvatarPicker'
import { MemberPicker } from '../MemberPicker'
import { UserAvatar } from '../UserAvatar'
import { formatPhone } from '../../lib/phone'
import { formatLastSeen, isOnline } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import { uploadAvatar } from '../../lib/storage'
import type { ConversationSummary, Member, Profile } from '../../lib/types'

interface ChatInfoDrawerProps {
  open: boolean
  onClose: () => void
  conversation: ConversationSummary
  members: Member[]
  reloadMembers: () => Promise<void>
  now: number
}

export function ChatInfoDrawer({ open, onClose, conversation: c, members, reloadMembers, now }: ChatInfoDrawerProps) {
  const { userId } = useAuth()
  const { refresh, openDirectChat } = useChat()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(c.title ?? '')
  const [addOpen, setAddOpen] = useState(false)
  const [toAdd, setToAdd] = useState<Profile[]>([])
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [memberMenu, setMemberMenu] = useState<{ anchor: HTMLElement; member: Member } | null>(null)

  useEffect(() => setTitle(c.title ?? ''), [c.title])
  useEffect(() => {
    if (!open) {
      setError(null)
      setEditingTitle(false)
    }
  }, [open])

  const isGroup = c.type === 'group'
  const me = members.find((m) => m.user_id === userId)
  const myRole = me?.role ?? c.my_role
  const canManage = isGroup && (myRole === 'owner' || myRole === 'admin')
  const peer = !isGroup ? (members.find((m) => m.user_id !== userId)?.profile ?? c.peer) : null

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const rpcOrThrow = async (p: PromiseLike<{ error: unknown }>) => {
    const { error: err } = await p
    if (err) throw err
  }

  const saveTitle = () =>
    run(async () => {
      await rpcOrThrow(supabase.rpc('update_group', { p_conversation_id: c.id, p_title: title }))
      setEditingTitle(false)
      await refresh()
    })

  const changeAvatar = (file: File | null) =>
    file &&
    userId &&
    run(async () => {
      const path = await uploadAvatar(userId, file)
      await rpcOrThrow(supabase.rpc('update_group', { p_conversation_id: c.id, p_avatar_path: path }))
      await refresh()
    })

  const addMembers = () =>
    run(async () => {
      await rpcOrThrow(supabase.rpc('add_group_members', { p_conversation_id: c.id, p_member_ids: toAdd.map((p) => p.id) }))
      setAddOpen(false)
      setToAdd([])
      await Promise.all([reloadMembers(), refresh()])
    })

  const removeMember = (member: Member) =>
    run(async () => {
      await rpcOrThrow(supabase.rpc('remove_group_member', { p_conversation_id: c.id, p_user_id: member.user_id }))
      await Promise.all([reloadMembers(), refresh()])
    })

  const setRole = (member: Member, role: 'admin' | 'member') =>
    run(async () => {
      await rpcOrThrow(supabase.rpc('set_member_role', { p_conversation_id: c.id, p_user_id: member.user_id, p_role: role }))
      await reloadMembers()
    })

  const leave = () =>
    run(async () => {
      if (!userId) return
      await rpcOrThrow(supabase.rpc('remove_group_member', { p_conversation_id: c.id, p_user_id: userId }))
      setConfirmLeave(false)
      onClose()
      await refresh()
      navigate('/')
    })

  const messageMember = (member: Member) =>
    run(async () => {
      const id = await openDirectChat(member.user_id)
      onClose()
      navigate(`/c/${id}`)
    })

  const canRemove = (m: Member) =>
    m.user_id !== userId && (myRole === 'owner' ? true : myRole === 'admin' ? m.role === 'member' : false)

  const sortedMembers = [...members].sort((a, b) => {
    const rank = { owner: 0, admin: 1, member: 2 } as const
    return rank[a.role] - rank[b.role] || (a.profile?.display_name ?? '').localeCompare(b.profile?.display_name ?? '')
  })

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 380 } } } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 1, py: 1.5, gap: 1 }}>
        <IconButton onClick={onClose} aria-label="Close info">
          <CloseRoundedIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isGroup ? 'Group info' : 'Contact info'}
        </Typography>
      </Stack>

      <Box sx={{ overflowY: 'auto', pb: 4 }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', px: 3, pb: 3, textAlign: 'center' }}>
          {isGroup && canManage ? (
            <AvatarPicker
              id={c.id}
              name={c.title ?? ''}
              file={null}
              path={c.avatar_path}
              onFile={(f) => void changeAvatar(f)}
              size={120}
              disabled={busy}
            />
          ) : (
            <UserAvatar
              id={isGroup ? c.id : peer?.id}
              name={conversationTitle(c)}
              path={isGroup ? c.avatar_path : peer?.avatar_path}
              group={isGroup}
              size={120}
            />
          )}

          {isGroup && editingTitle ? (
            <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
              <TextField
                size="small"
                fullWidth
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 64))}
                onKeyDown={(e) => e.key === 'Enter' && title.trim() && void saveTitle()}
              />
              <Button variant="contained" disabled={busy || !title.trim()} onClick={() => void saveTitle()}>
                Save
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {conversationTitle(c)}
              </Typography>
              {canManage && (
                <IconButton size="small" onClick={() => setEditingTitle(true)} aria-label="Rename group">
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          )}
          <Typography variant="body2" color={!isGroup && isOnline(peer?.last_seen_at, now) ? 'primary.main' : 'text.secondary'}>
            {isGroup ? `Group · ${members.length} members` : formatLastSeen(peer?.last_seen_at, now)}
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        <Divider />

        {!isGroup && peer && (
          <List>
            <ListItem
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="Copy phone number"
                  onClick={() => void navigator.clipboard?.writeText(peer.phone ?? '')}
                >
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemIcon>
                <PhoneRoundedIcon />
              </ListItemIcon>
              <ListItemText primary={formatPhone(peer.phone)} secondary="Mobile" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary={peer.about || '—'} secondary="About" />
            </ListItem>
          </List>
        )}

        {isGroup && (
          <>
            <Typography variant="overline" color="text.secondary" sx={{ px: 3, pt: 2, display: 'block' }}>
              {members.length} members
            </Typography>
            <List>
              {canManage && (
                <ListItemButton onClick={() => setAddOpen(true)} sx={{ px: 3 }}>
                  <ListItemIcon>
                    <PersonAddAlt1RoundedIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Add members" slotProps={{ primary: { sx: { color: 'primary.main', fontWeight: 600 } } }} />
                </ListItemButton>
              )}
              {sortedMembers.map((m) => (
                <ListItem
                  key={m.id}
                  sx={{ px: 3 }}
                  secondaryAction={
                    m.user_id !== userId ? (
                      <IconButton
                        edge="end"
                        aria-label={`Options for ${m.profile?.display_name ?? 'member'}`}
                        onClick={(e) => setMemberMenu({ anchor: e.currentTarget, member: m })}
                      >
                        <MoreVertRoundedIcon />
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemAvatar>
                    <UserAvatar
                      id={m.user_id}
                      name={m.profile?.display_name}
                      path={m.profile?.avatar_path}
                      online={m.user_id !== userId && isOnline(m.profile?.last_seen_at, now)}
                      size={40}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <span>{m.user_id === userId ? 'You' : (m.profile?.display_name ?? 'Unknown')}</span>
                        {m.role !== 'member' && (
                          <Chip size="small" label={m.role === 'owner' ? 'Owner' : 'Admin'} color="primary" variant="outlined" />
                        )}
                      </Stack>
                    }
                    secondary={m.user_id === userId ? formatPhone(m.profile?.phone) : formatLastSeen(m.profile?.last_seen_at, now)}
                  />
                </ListItem>
              ))}
            </List>
            <Divider />
            <List>
              <ListItemButton onClick={() => setConfirmLeave(true)} sx={{ px: 3, color: 'error.main' }}>
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <LogoutRoundedIcon />
                </ListItemIcon>
                <ListItemText primary="Leave group" />
              </ListItemButton>
            </List>
          </>
        )}
      </Box>

      <Menu anchorEl={memberMenu?.anchor} open={Boolean(memberMenu)} onClose={() => setMemberMenu(null)}>
        {memberMenu && [
          <MenuItem
            key="msg"
            onClick={() => {
              const m = memberMenu.member
              setMemberMenu(null)
              void messageMember(m)
            }}
          >
            <ListItemIcon>
              <ChatRoundedIcon fontSize="small" />
            </ListItemIcon>
            Message
          </MenuItem>,
          myRole === 'owner' && memberMenu.member.role === 'member' && (
            <MenuItem
              key="promote"
              onClick={() => {
                const m = memberMenu.member
                setMemberMenu(null)
                void setRole(m, 'admin')
              }}
            >
              Make admin
            </MenuItem>
          ),
          myRole === 'owner' && memberMenu.member.role === 'admin' && (
            <MenuItem
              key="demote"
              onClick={() => {
                const m = memberMenu.member
                setMemberMenu(null)
                void setRole(m, 'member')
              }}
            >
              Remove admin rights
            </MenuItem>
          ),
          canRemove(memberMenu.member) && (
            <MenuItem
              key="remove"
              sx={{ color: 'error.main' }}
              onClick={() => {
                const m = memberMenu.member
                setMemberMenu(null)
                void removeMember(m)
              }}
            >
              Remove from group
            </MenuItem>
          ),
        ]}
      </Menu>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add members</DialogTitle>
        <DialogContent>
          <MemberPicker selected={toAdd} onChange={setToAdd} excludeIds={members.map((m) => m.user_id)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || toAdd.length === 0} onClick={() => void addMembers()}>
            {busy ? <CircularProgress size={20} color="inherit" /> : `Add ${toAdd.length || ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <DialogTitle>Leave “{c.title}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You will stop receiving messages from this group.
            {myRole === 'owner' && ' Ownership will pass to an admin or the longest-standing member.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeave(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={busy} onClick={() => void leave()}>
            Leave group
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}
