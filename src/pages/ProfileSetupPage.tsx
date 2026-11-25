import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useAuth } from '../contexts/AuthContext'
import { AvatarPicker } from '../components/AvatarPicker'
import { formatPhone } from '../lib/phone'
import { errorMessage } from '../lib/errors'
import { uploadAvatar } from '../lib/storage'

export default function ProfileSetupPage() {
  const { profile, userId, updateProfile, signOut } = useAuth()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!userId || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const avatar_path = file ? await uploadAvatar(userId, file) : undefined
      await updateProfile({ display_name: name.trim(), ...(avatar_path ? { avatar_path } : {}) })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, bgcolor: 'background.default' }}>
      <Paper
        elevation={0}
        sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: '24px', border: '1px solid', borderColor: 'divider' }}
      >
        <Stack
          spacing={3}
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Stack spacing={1} sx={{ textAlign: 'center' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              Your profile
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your name and an optional photo. People who chat with you will see them.
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <AvatarPicker id={userId} name={name} file={file} onFile={setFile} size={104} />
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 64))}
            autoFocus
            required
            disabled={busy}
            helperText={profile?.phone ? `Signed in as ${formatPhone(profile.phone)}` : ' '}
          />
          <Button type="submit" variant="contained" size="large" disabled={busy || !name.trim()}>
            {busy ? <CircularProgress size={22} color="inherit" /> : 'Start messaging'}
          </Button>
          <Button color="inherit" onClick={() => void signOut()} disabled={busy}>
            Use a different number
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
