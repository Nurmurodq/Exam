import Avatar from '@mui/material/Avatar'
import Badge from '@mui/material/Badge'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import { avatarUrl } from '../lib/storage'
import { colorForId, initials } from '../lib/format'

interface UserAvatarProps {
  id: string | null | undefined
  name: string | null | undefined
  path: string | null | undefined
  size?: number
  online?: boolean
  group?: boolean
}

export function UserAvatar({ id, name, path, size = 44, online = false, group = false }: UserAvatarProps) {
  const avatar = (
    <Avatar
      src={avatarUrl(path)}
      alt={name ?? ''}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        fontWeight: 600,
        bgcolor: colorForId(id),
        color: '#fff',
      }}
      slotProps={{ img: { loading: 'lazy', draggable: false } }}
    >
      {group && !name ? <GroupsRoundedIcon sx={{ fontSize: size * 0.55 }} /> : initials(name)}
    </Avatar>
  )
  if (!online) return avatar
  return (
    <Badge
      overlap="circular"
      variant="dot"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      aria-label="online"
      sx={{
        '& .MuiBadge-badge': {
          bgcolor: '#22c55e',
          width: Math.max(10, size * 0.26),
          height: Math.max(10, size * 0.26),
          borderRadius: '50%',
          border: '2px solid',
          borderColor: 'background.paper',
        },
      }}
    >
      {avatar}
    </Badge>
  )
}
