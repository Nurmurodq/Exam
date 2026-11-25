import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChat } from '../contexts/ChatContext'
import type { Member, Profile } from '../lib/types'

const SELECT =
  'id, conversation_id, user_id, role, joined_at, last_read_at, profile:profiles(id, phone, display_name, about, avatar_path, last_seen_at)'

export function useMembers(conversationId: string) {
  const { onMember, rememberProfiles, profiles } = useChat()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversation_members')
      .select(SELECT)
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true })
    if (!error && data) {
      const rows = data as unknown as Member[]
      setMembers(rows)
      rememberProfiles(rows.flatMap((m) => (m.profile ? [m.profile] : [])))
    }
    setLoading(false)
  }, [conversationId, rememberProfiles])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(
    () =>
      onMember((type, row) => {
        if (row.conversation_id !== conversationId) return
        if (type === 'INSERT') {
          void load()
          return
        }
        setMembers((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row, profile: m.profile } : m)))
      }),
    [conversationId, load, onMember],
  )

  // Overlay live profile updates (name, avatar, last seen) from the chat cache.
  const withLiveProfiles = useMemo(
    () =>
      members.map((m) => {
        const live: Profile | undefined = profiles[m.user_id]
        return live && m.profile ? { ...m, profile: { ...m.profile, ...live } } : m
      }),
    [members, profiles],
  )

  return { members: withLiveProfiles, loading, reload: load }
}
