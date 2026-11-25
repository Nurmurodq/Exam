import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChat } from '../contexts/ChatContext'
import { useAuth } from '../contexts/AuthContext'
import { attachmentPath, uploadAttachment } from '../lib/storage'
import type { ChatMessage, Message } from '../lib/types'

const PAGE_SIZE = 50

function byCreatedAt(a: ChatMessage, b: ChatMessage) {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

function upsert(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = list.findIndex((m) => m.id === incoming.id)
  if (idx === -1) return [...list, incoming].sort(byCreatedAt)
  const next = [...list]
  const prev = next[idx]
  if (prev.localPreviewUrl && !incoming.localPreviewUrl) {
    // Keep showing the local preview until the signed URL loads; avoids flicker.
    next[idx] = { ...incoming, localPreviewUrl: prev.localPreviewUrl }
  } else {
    next[idx] = incoming
  }
  return next.sort(byCreatedAt)
}

export interface SendInput {
  body: string
  file?: File | null
  replyToId?: string | null
}

export function useMessages(conversationId: string) {
  const { userId } = useAuth()
  const { onMessage } = useChat()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        const rows = ((data ?? []) as Message[]).reverse()
        // Merge with anything that arrived over realtime while loading.
        setMessages((live) => live.reduce(upsert, rows as ChatMessage[]))
        setHasMore((data ?? []).length === PAGE_SIZE)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(
    () =>
      onMessage((_type, message) => {
        if (message.conversation_id !== conversationId) return
        setMessages((prev) => upsert(prev, message))
      }),
    [conversationId, onMessage],
  )

  // Free object URLs created for optimistic image previews.
  useEffect(
    () => () => {
      messagesRef.current.forEach((m) => m.localPreviewUrl && URL.revokeObjectURL(m.localPreviewUrl))
    },
    [],
  )

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current.find((m) => !m.status)
    if (!oldest || loadingOlder || !hasMore) return
    setLoadingOlder(true)
    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (!err && data) {
      setMessages((prev) => (data as Message[]).reduce(upsert, prev))
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoadingOlder(false)
  }, [conversationId, hasMore, loadingOlder])

  const deliver = useCallback(
    async (draft: ChatMessage) => {
      try {
        if (draft.localFile && draft.attachment_path) {
          await uploadAttachment(draft.attachment_path, draft.localFile)
        }
        const { data, error: err } = await supabase
          .from('messages')
          .insert({
            id: draft.id,
            conversation_id: draft.conversation_id,
            body: draft.body,
            attachment_path: draft.attachment_path,
            attachment_name: draft.attachment_name,
            attachment_mime: draft.attachment_mime,
            attachment_size: draft.attachment_size,
            reply_to_id: draft.reply_to_id,
          })
          .select('*')
          .single()
        if (err) throw err
        setMessages((prev) => upsert(prev, { ...(data as Message), localPreviewUrl: draft.localPreviewUrl }))
      } catch (e) {
        console.error('Send failed', e)
        setMessages((prev) => prev.map((m) => (m.id === draft.id ? { ...m, status: 'failed' } : m)))
        throw e
      }
    },
    [],
  )

  const send = useCallback(
    async ({ body, file, replyToId }: SendInput) => {
      if (!userId) return
      const text = body.trim()
      if (!text && !file) return
      const id = crypto.randomUUID()
      const draft: ChatMessage = {
        id,
        conversation_id: conversationId,
        sender_id: userId,
        body: text || null,
        attachment_path: file ? attachmentPath(conversationId, userId, file) : null,
        attachment_name: file?.name ?? null,
        attachment_mime: file ? file.type || 'application/octet-stream' : null,
        attachment_size: file?.size ?? null,
        reply_to_id: replyToId ?? null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        status: 'sending',
        localFile: file ?? undefined,
        localPreviewUrl: file && file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }
      setMessages((prev) => [...prev, draft])
      await deliver(draft)
    },
    [conversationId, deliver, userId],
  )

  const retry = useCallback(
    async (id: string) => {
      const draft = messagesRef.current.find((m) => m.id === id)
      if (!draft || draft.status !== 'failed') return
      const again = { ...draft, status: 'sending' as const, created_at: new Date().toISOString() }
      setMessages((prev) => upsert(prev, again))
      await deliver(again)
    },
    [deliver],
  )

  const discard = useCallback((id: string) => {
    setMessages((prev) => {
      const m = prev.find((x) => x.id === id)
      if (m?.localPreviewUrl) URL.revokeObjectURL(m.localPreviewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }, [])

  const edit = useCallback(async (id: string, body: string) => {
    const { data, error: err } = await supabase.from('messages').update({ body }).eq('id', id).select('*').single()
    if (err) throw err
    setMessages((prev) => upsert(prev, data as Message))
  }, [])

  const remove = useCallback(async (id: string) => {
    const target = messagesRef.current.find((m) => m.id === id)
    const { data, error: err } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (err) throw err
    setMessages((prev) => upsert(prev, data as Message))
    if (target?.attachment_path) {
      await supabase.storage.from('attachments').remove([target.attachment_path])
    }
  }, [])

  return { messages, loading, loadingOlder, hasMore, error, loadOlder, send, retry, discard, edit, remove }
}

/** Loads a message that is referenced by a reply but not in the loaded page. */
const replyCache = new Map<string, Promise<Message | null>>()
export function fetchMessageById(id: string): Promise<Message | null> {
  let p = replyCache.get(id)
  if (!p) {
    p = Promise.resolve(
      supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(({ data }) => (data as Message | null) ?? null),
    )
    replyCache.set(id, p)
  }
  return p
}
