import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'

export interface CountryOption {
  code: CountryCode
  name: string
  dialCode: string
  flag: string
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' })
    : null

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))
}

export const COUNTRIES: CountryOption[] = getCountries()
  .map((code) => ({
    code,
    name: regionNames?.of(code) ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: flagEmoji(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function guessDefaultCountry(): CountryCode {
  const fromStorage = safeLocalStorageGet('parley-country')
  if (fromStorage && COUNTRIES.some((c) => c.code === fromStorage)) return fromStorage as CountryCode
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const locale of locales) {
    const region = locale?.split('-')[1]?.toUpperCase()
    if (region && COUNTRIES.some((c) => c.code === region)) return region as CountryCode
  }
  return 'US'
}

export function rememberCountry(code: CountryCode) {
  try {
    localStorage.setItem('parley-country', code)
  } catch {
    /* storage may be unavailable */
  }
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Formats national digits as the user types, e.g. "201 555 0123". */
export function formatAsYouType(input: string, country: CountryCode): string {
  return new AsYouType(country).input(input)
}

/** Returns the E.164 number ("+15555550100") or null if invalid. */
export function toE164(input: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(input, country)
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

/** "+15555550100" -> "+1 555 555 0100" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const parsed = parsePhoneNumberFromString(e164)
  return parsed ? parsed.formatInternational() : e164
}
