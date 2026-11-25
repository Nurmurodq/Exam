export type ConversationType = 'direct' | 'group'
export type MemberRole = 'owner' | 'admin' | 'member'

export interface Profile {
  id: string
  phone: string | null
  display_name: string
  about: string
  avatar_path: string | null
  last_seen_at: string
}

export interface LastMessage {
  id: string
  body: string | null
  sender_id: string | null
  sender_name: string | null
  created_at: string
  attachment_mime: string | null
  attachment_name: string | null
  deleted_at: string | null
}

export interface ConversationSummary {
  id: string
  type: ConversationType
  title: string | null
  avatar_path: string | null
  created_at: string
  last_message_at: string
  my_role: MemberRole
  last_read_at: string
  unread_count: number
  member_count: number
  last_message: LastMessage | null
  peer: Profile | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_mime: string | null
  attachment_size: number | null
  reply_to_id: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

/** A message as held in UI state: may still be uploading/sending. */
export interface ChatMessage extends Message {
  status?: 'sending' | 'failed'
  localPreviewUrl?: string
  localFile?: File
}

export interface Member {
  id: string
  conversation_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  last_read_at: string
  profile: Profile | null
}
