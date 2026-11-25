import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { PhoneLookup } from './PhoneLookup'
import { UserAvatar } from './UserAvatar'
import { formatPhone } from '../lib/phone'
import type { Profile } from '../lib/types'

interface MemberPickerProps {
  selected: Profile[]
  onChange: (selected: Profile[]) => void
  excludeIds?: string[]
}

/** Pick people from your contacts, or add anyone by phone number. */
export function MemberPicker({ selected, onChange, excludeIds = [] }: MemberPickerProps) {
  const { userId } = useAuth()
  const { profiles } = useChat()
  const [extra, setExtra] = useState<Profile[]>([])
  const [lookupOpen, setLookupOpen] = useState(false)

  const candidates = useMemo(() => {
    const byId = new Map<string, Profile>()
    for (const p of [...Object.values(profiles), ...extra]) {
      if (p.id !== userId && !excludeIds.includes(p.id) && p.display_name) byId.set(p.id, p)
    }
    return [...byId.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [profiles, extra, userId, excludeIds])

  const isSelected = (id: string) => selected.some((p) => p.id === id)
  const toggle = (p: Profile) =>
    onChange(isSelected(p.id) ? selected.filter((s) => s.id !== p.id) : [...selected, p])

  return (
    <Stack spacing={2}>
      {selected.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selected.map((p) => (
            <Chip
              key={p.id}
              label={p.display_name}
              avatar={<UserAvatar id={p.id} name={p.display_name} path={p.avatar_path} size={24} />}
              onDelete={() => toggle(p)}
            />
          ))}
        </Box>
      )}

      <Box>
        <Button
          startIcon={<PersonSearchRoundedIcon />}
          onClick={() => setLookupOpen((o) => !o)}
          variant={lookupOpen ? 'outlined' : 'text'}
        >
          Add by phone number
        </Button>
        <Collapse in={lookupOpen} unmountOnExit>
          <Box sx={{ pt: 2 }}>
            <PhoneLookup
              buttonLabel="Add"
              onFound={(p) => {
                if (excludeIds.includes(p.id)) return
                setExtra((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]))
                if (!isSelected(p.id)) onChange([...selected, p])
              }}
            />
          </Box>
        </Collapse>
      </Box>

      {candidates.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          People you chat with will appear here. Use “Add by phone number” to find someone new.
        </Typography>
      ) : (
        <List dense disablePadding sx={{ mx: -1 }}>
          {candidates.map((p) => (
            <ListItemButton key={p.id} onClick={() => toggle(p)} sx={{ borderRadius: 2 }}>
              <ListItemAvatar>
                <UserAvatar id={p.id} name={p.display_name} path={p.avatar_path} size={36} />
              </ListItemAvatar>
              <ListItemText primary={p.display_name} secondary={formatPhone(p.phone)} />
              <Checkbox edge="end" checked={isSelected(p.id)} tabIndex={-1} disableRipple />
            </ListItemButton>
          ))}
        </List>
      )}
    </Stack>
  )
}
