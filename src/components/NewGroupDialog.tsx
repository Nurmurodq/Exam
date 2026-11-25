import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { MemberPicker } from './MemberPicker'
import { AvatarPicker } from './AvatarPicker'
import { uploadAvatar } from '../lib/storage'
import { errorMessage } from '../lib/errors'
import type { Profile } from '../lib/types'

export function NewGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { refresh } = useChat()
  const [step, setStep] = useState<'members' | 'details'>('members')
  const [members, setMembers] = useState<Profile[]>([])
  const [title, setTitle] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep('members')
    setMembers([])
    setTitle('')
    setAvatar(null)
    setError(null)
    setBusy(false)
  }

  const close = () => {
    reset()
    onClose()
  }

  const create = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const { data: id, error: err } = await supabase.rpc('create_group_conversation', {
        p_title: title.trim(),
        p_member_ids: members.map((m) => m.id),
      })
      if (err) throw err
      if (avatar) {
        const path = await uploadAvatar(userId, avatar)
        await supabase.rpc('update_group', { p_conversation_id: id as string, p_avatar_path: path })
      }
      await refresh()
      close()
      navigate(`/c/${id}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        {step === 'details' && (
          <IconButton onClick={() => setStep('members')} aria-label="Back" sx={{ ml: -1 }}>
            <ArrowBackRoundedIcon />
          </IconButton>
        )}
        <Box sx={{ flex: 1 }}>{step === 'members' ? 'Add members' : 'New group'}</Box>
        <IconButton onClick={close} aria-label="Close">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {step === 'members' ? (
          <MemberPicker selected={members} onChange={setMembers} />
        ) : (
          <Stack spacing={3} sx={{ alignItems: 'center', pt: 1 }}>
            <AvatarPicker id={null} name={title || 'G'} file={avatar} onFile={setAvatar} size={96} disabled={busy} />
            <TextField
              fullWidth
              autoFocus
              label="Group name"
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value.slice(0, 64))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) void create()
              }}
              helperText={`${members.length} member${members.length === 1 ? '' : 's'} + you`}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step === 'members' ? (
          <Button variant="contained" disabled={members.length === 0} onClick={() => setStep('details')}>
            Next
          </Button>
        ) : (
          <Button variant="contained" disabled={busy || !title.trim()} onClick={() => void create()}>
            {busy ? <CircularProgress size={20} color="inherit" /> : 'Create group'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
