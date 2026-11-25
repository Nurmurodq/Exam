import { supabase } from './supabase'

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function avatarUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

function extensionOf(file: File) {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : ''
  return (fromName || file.type.split('/')[1] || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Resize an image client-side so avatars stay small. */
async function downscaleImage(file: File, maxSize = 512): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  const blob = await downscaleImage(file)
  if (blob.size > MAX_AVATAR_BYTES) throw new Error('Image is too large (max 5 MB)')
  const ext = blob === file ? extensionOf(file) : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000' })
  if (error) throw error
  return path
}

export async function removeAvatar(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from('avatars').remove([path])
}

export function attachmentPath(conversationId: string, userId: string, file: File) {
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80) || `file.${extensionOf(file)}`
  return `${conversationId}/${userId}/${crypto.randomUUID()}-${safeName}`
}

export async function uploadAttachment(path: string, file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('File is too large (max 20 MB)')
  const { error } = await supabase.storage
    .from('attachments')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (error) throw error
}

// Signed URLs are cached so scrolling does not refetch them.
const signedCache = new Map<string, { url: string; expires: number }>()
const pending = new Map<string, Promise<string>>()
const SIGNED_TTL_SECONDS = 60 * 60

export async function signedAttachmentUrl(path: string): Promise<string> {
  const cached = signedCache.get(path)
  if (cached && cached.expires > Date.now() + 60_000) return cached.url
  const inflight = pending.get(path)
  if (inflight) return inflight
  const promise = supabase.storage
    .from('attachments')
    .createSignedUrl(path, SIGNED_TTL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data) throw error ?? new Error('Could not load file')
      signedCache.set(path, { url: data.signedUrl, expires: Date.now() + SIGNED_TTL_SECONDS * 1000 })
      return data.signedUrl
    })
    .finally(() => pending.delete(path))
  pending.set(path, promise)
  return promise
}
