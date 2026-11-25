import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useColorScheme } from '@mui/material/styles'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded'
import { useAuth } from '../contexts/AuthContext'
import { AvatarPicker } from './AvatarPicker'
import { removeAvatar, uploadAvatar } from '../lib/storage'
import { formatPhone } from '../lib/phone'
import { errorMessage } from '../lib/errors'

export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, userId, updateProfile, signOut } = useAuth()
  const { mode, setMode } = useColorScheme()
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  useEffect(() => {
    if (open && profile) {
      setName(profile.display_name)
      setAbout(profile.about)
      setError(null)
      setSaved(false)
    }
  }, [open, profile])

  const dirty = profile && (name.trim() !== profile.display_name || about.trim() !== profile.about)

  const save = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateProfile({ display_name: name.trim(), about: about.trim() })
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const changeAvatar = async (file: File | null) => {
    if (!file || !userId) return
    setBusy(true)
    setError(null)
    try {
      const old = profile?.avatar_path
      const path = await uploadAvatar(userId, file)
      await updateProfile({ avatar_path: path })
      void removeAvatar(old)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const clearAvatar = async () => {
    setBusy(true)
    try {
      const old = profile?.avatar_path
      await updateProfile({ avatar_path: null })
      void removeAvatar(old)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return
    setPermission(await Notification.requestPermission())
  }

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', md: 400 }, bgcolor: 'chat.sidebar' } } }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1, py: 1.5 }}>
        <IconButton onClick={onClose} aria-label="Close settings">
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Profile &amp; settings
        </Typography>
      </Stack>
      <Box sx={{ overflowY: 'auto', px: 3, pb: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <AvatarPicker
              id={userId}
              name={profile?.display_name ?? ''}
              file={null}
              path={profile?.avatar_path}
              onFile={(f) => void changeAvatar(f)}
              onRemove={() => void clearAvatar()}
              size={120}
              disabled={busy}
            />
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {saved && !dirty && <Alert severity="success">Profile saved</Alert>}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 64))
              setSaved(false)
            }}
            disabled={busy}
          />
          <TextField
            label="About"
            value={about}
            onChange={(e) => {
              setAbout(e.target.value.slice(0, 140))
              setSaved(false)
            }}
            disabled={busy}
            multiline
            maxRows={3}
            helperText={`${about.length}/140`}
          />
          <Button variant="contained" onClick={() => void save()} disabled={busy || !dirty}>
            Save changes
          </Button>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <PhoneIphoneRoundedIcon color="action" />
            <Box>
              <Typography>{formatPhone(profile?.phone)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Verified phone number · used to sign in
              </Typography>
            </Box>
          </Stack>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">
              Appearance
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={mode ?? 'system'}
              onChange={(_, value) => value && setMode(value)}
              sx={{ mt: 1 }}
            >
              <ToggleButton value="light" aria-label="Light theme">
                <LightModeRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Light
              </ToggleButton>
              <ToggleButton value="system" aria-label="System theme">
                <SettingsBrightnessRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Auto
              </ToggleButton>
              <ToggleButton value="dark" aria-label="Dark theme">
                <DarkModeRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Dark
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Notifications
            </Typography>
            <Box sx={{ mt: 1 }}>
              {permission === 'granted' ? (
                <Typography variant="body2" color="text.secondary">
                  Desktop notifications are on for new messages while Parley is in the background.
                </Typography>
              ) : permission === 'denied' ? (
                <Typography variant="body2" color="text.secondary">
                  Notifications are blocked. Allow them in your browser’s site settings.
                </Typography>
              ) : permission === 'unsupported' ? (
                <Typography variant="body2" color="text.secondary">
                  This browser does not support notifications.
                </Typography>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<NotificationsActiveRoundedIcon />}
                  onClick={() => void enableNotifications()}
                >
                  Enable desktop notifications
                </Button>
              )}
            </Box>
          </Box>

          <Divider />

          <Button color="error" variant="outlined" startIcon={<LogoutRoundedIcon />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </Stack>
      </Box>
    </Drawer>
  )
}
