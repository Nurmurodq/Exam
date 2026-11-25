import { useEffect, useState } from 'react'
import { signedAttachmentUrl } from '../lib/storage'
import type { ChatMessage } from '../lib/types'

export function useSignedUrl(path: string | null, skip = false) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!path || skip) return
    let cancelled = false
    signedAttachmentUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [path, skip])
  return { url, failed }
}

export function isImage(m: Pick<ChatMessage, 'attachment_mime'>) {
  return Boolean(m.attachment_mime?.startsWith('image/'))
}
