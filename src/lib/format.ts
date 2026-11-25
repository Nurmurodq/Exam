const locale = typeof navigator !== 'undefined' ? navigator.language : 'en'

const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
const shortDateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
const fullDateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
const dayMonthFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function daysAgo(date: Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** Chat list timestamp: "14:05", "Yesterday", "Mon", "12 Mar". */
export function formatListTimestamp(iso: string): string {
  const date = new Date(iso)
  const diff = daysAgo(date)
  if (diff <= 0) return timeFmt.format(date)
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return weekdayFmt.format(date)
  return shortDateFmt.format(date)
}

/** Date separator inside a chat: "Today", "Yesterday", "12 March", "12 March 2024". */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso)
  const diff = daysAgo(date)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (date.getFullYear() === new Date().getFullYear()) return dayMonthFmt.format(date)
  return fullDateFmt.format(date)
}

export function isSameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

export const ONLINE_WINDOW_MS = 70_000

export function isOnline(lastSeen: string | null | undefined, now = Date.now()) {
  if (!lastSeen) return false
  return now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS
}

export function formatLastSeen(lastSeen: string | null | undefined, now = Date.now()): string {
  if (!lastSeen) return 'last seen a long time ago'
  if (isOnline(lastSeen, now)) return 'online'
  const date = new Date(lastSeen)
  const minutes = Math.floor((now - date.getTime()) / 60_000)
  if (minutes < 1) return 'last seen just now'
  if (minutes < 60) return `last seen ${minutes} min ago`
  const diff = daysAgo(date)
  if (diff === 0) return `last seen today at ${timeFmt.format(date)}`
  if (diff === 1) return `last seen yesterday at ${timeFmt.format(date)}`
  return `last seen ${shortDateFmt.format(date)}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function initials(name: string | null | undefined): string {
  // Work on whole code points (emoji are surrogate pairs) and only use letters/digits.
  const firstChar = (word: string) => Array.from(word).find((ch) => /[\p{L}\p{N}]/u.test(ch))
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .map(firstChar)
    .filter((ch): ch is string => Boolean(ch))
  if (letters.length === 0) return '?'
  return (letters[0] + (letters.length > 1 ? letters[letters.length - 1] : '')).toUpperCase()
}

const AVATAR_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#5b8def']

export function colorForId(id: string | null | undefined): string {
  if (!id) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
