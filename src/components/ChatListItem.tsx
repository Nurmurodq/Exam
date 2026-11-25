import { memo } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import { UserAvatar } from './UserAvatar'
import { conversationTitle, previewText } from '../lib/conversation'
import { formatListTimestamp, isOnline } from '../lib/format'
import type { ConversationSummary } from '../lib/types'

interface ChatListItemProps {
  conversation: ConversationSummary
  selected: boolean
  myId: string | null
  now: number
  onClick: () => void
}

export const ChatListItem = memo(function ChatListItem({ conversation: c, selected, myId, now, onClick }: ChatListItemProps) {
  const title = conversationTitle(c)
  const online = c.type === 'direct' && isOnline(c.peer?.last_seen_at, now)
  const unread = c.unread_count > 0
  const timestamp = c.last_message?.created_at ?? c.created_at

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        mx: 1,
        my: 0.25,
        px: 1.25,
        py: 1,
        gap: 1.5,
        borderRadius: 2.5,
        alignItems: 'center',
        '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' },
        '&.Mui-selected:hover': { bgcolor: 'primary.main' },
      }}
      aria-label={`Chat with ${title}${unread ? `, ${c.unread_count} unread` : ''}`}
    >
      <UserAvatar
        id={c.type === 'group' ? c.id : c.peer?.id}
        name={title}
        path={c.type === 'group' ? c.avatar_path : c.peer?.avatar_path}
        online={online}
        group={c.type === 'group'}
        size={50}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography noWrap sx={{ flex: 1, fontWeight: 600, fontSize: 15 }}>
            {title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              flexShrink: 0,
              color: selected ? 'inherit' : unread ? 'primary.main' : 'text.secondary',
              opacity: selected ? 0.85 : 1,
              fontWeight: unread ? 600 : 400,
            }}
          >
            {formatListTimestamp(timestamp)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
          <Typography
            variant="body2"
            noWrap
            sx={{
              flex: 1,
              color: selected ? 'inherit' : 'text.secondary',
              opacity: selected ? 0.85 : 1,
              fontStyle: c.last_message?.deleted_at ? 'italic' : 'normal',
            }}
          >
            {previewText(c, myId)}
          </Typography>
          {unread && (
            <Badge
              badgeContent={c.unread_count}
              max={999}
              sx={{
                mr: 1.25,
                '& .MuiBadge-badge': {
                  position: 'static',
                  transform: 'none',
                  bgcolor: selected ? 'primary.contrastText' : 'primary.main',
                  color: selected ? 'primary.main' : 'primary.contrastText',
                  fontWeight: 700,
                },
              }}
            />
          )}
        </Box>
      </Box>
    </ListItemButton>
  )
})
