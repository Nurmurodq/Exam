export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    const msg = error.message
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Network error. Check your connection.'
    if (/Token has expired or is invalid/i.test(msg)) return 'That code is wrong or has expired.'
    if (/Unsupported phone provider/i.test(msg)) return 'SMS sign-in is not configured on the server yet.'
    if (/rate limit|too many requests/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
    return msg
  }
  return fallback
}
