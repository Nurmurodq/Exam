import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { UserAvatar } from '../UserAvatar'
import { conversationTitle } from '../../lib/conversation'
import { formatLastSeen, isOnline } from '../../lib/format'
import type { ConversationSummary, Member } from '../../lib/types'

interface ChatHeaderProps {
  conversation: ConversationSummary
  members: Member[]
  myId: string | null
  typingLabel: string | null
  now: number
  onBack: () => void
  onOpenInfo: () => void
}

export function ChatHeader({ conversation: c, members, myId, typingLabel, now, onBack, onOpenInfo }: ChatHeaderProps) {
  const title = conversationTitle(c)
  const peer = c.type === 'direct' ? (members.find((m) => m.user_id !== myId)?.profile ?? c.peer) : null
  const online = peer ? isOnline(peer.last_seen_at, now) : false

  let subtitle: string
  if (typingLabel) subtitle = typingLabel
  else if (c.type === 'direct') subtitle = peer ? formatLastSeen(peer.last_seen_at, now) : ''
  else {
    const count = members.length || c.member_count
    const onlineCount = members.filter((m) => m.user_id !== myId && isOnline(m.profile?.last_seen_at, now)).length
    subtitle = `${count} member${count === 1 ? '' : 's'}${onlineCount ? `, ${onlineCount} online` : ''}`
  }

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        minHeight: 60,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <IconButton onClick={onBack} aria-label="Back to chats" sx={{ display: { md: 'none' } }}>
        <ArrowBackRoundedIcon />
      </IconButton>
      <ButtonBase
        onClick={onOpenInfo}
        sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1.5, borderRadius: 2, px: 1, py: 0.5, textAlign: 'left' }}
        aria-label={`Open info for ${title}`}
      >
        <UserAvatar
          id={c.type === 'group' ? c.id : peer?.id}
          name={title}
          path={c.type === 'group' ? c.avatar_path : peer?.avatar_path}
          online={online}
          group={c.type === 'group'}
          size={42}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600, lineHeight: 1.3 }} data-testid="chat-title">
            {title}
          </Typography>
          <Typography
            variant="caption"
            noWrap
            component="div"
            sx={{ color: typingLabel || online ? 'primary.main' : 'text.secondary', fontWeight: typingLabel ? 600 : 400 }}
          >
            {subtitle}
          </Typography>
        </Box>
      </ButtonBase>
      <Tooltip title={c.type === 'group' ? 'Group info' : 'Contact info'}>
        <IconButton onClick={onOpenInfo} aria-label="Chat info">
          <InfoOutlinedIcon />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
