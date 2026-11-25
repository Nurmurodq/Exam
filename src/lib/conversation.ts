import type { ConversationSummary } from './types'

export function conversationTitle(c: ConversationSummary | undefined): string {
  if (!c) return ''
  if (c.type === 'group') return c.title ?? 'Group'
  return c.peer?.display_name || c.peer?.phone || 'Deleted account'
}

export function previewText(c: ConversationSummary, myId: string | null): string {
  const m = c.last_message
  if (!m) return c.type === 'group' ? 'Group created' : 'Say hi 👋'
  if (m.deleted_at) return 'Message deleted'
  let text = m.body ?? ''
  if (!text && m.attachment_mime) text = m.attachment_mime.startsWith('image/') ? '📷 Photo' : `📎 ${m.attachment_name ?? 'File'}`
  else if (m.attachment_mime) text = `${m.attachment_mime.startsWith('image/') ? '📷' : '📎'} ${text}`
  if (m.sender_id === myId) return `You: ${text}`
  if (c.type === 'group' && m.sender_name) return `${m.sender_name}: ${text}`
  return text
}
