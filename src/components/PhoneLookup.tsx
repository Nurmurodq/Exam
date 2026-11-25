import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import type { CountryCode } from 'libphonenumber-js'
import { supabase } from '../lib/supabase'
import { PhoneInput } from './PhoneInput'
import { guessDefaultCountry, toE164 } from '../lib/phone'
import { errorMessage } from '../lib/errors'
import type { Profile } from '../lib/types'

interface PhoneLookupProps {
  onFound: (profile: Profile) => void
  buttonLabel?: string
}

/** Exact phone-number search (rate limited server-side). */
export function PhoneLookup({ onFound, buttonLabel = 'Find' }: PhoneLookupProps) {
  const [country, setCountry] = useState<CountryCode>(guessDefaultCountry)
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const search = async () => {
    setError(null)
    setNotFound(false)
    const e164 = toE164(number, country)
    if (!e164) {
      setError('Enter a valid phone number.')
      return
    }
    setBusy(true)
    const { data, error: err } = await supabase.rpc('find_user_by_phone', { p_phone: e164 })
    setBusy(false)
    if (err) {
      setError(errorMessage(err))
      return
    }
    const match = data?.[0]
    if (!match) {
      setNotFound(true)
      return
    }
    onFound({ ...match, last_seen_at: '' } as Profile)
    setNumber('')
  }

  return (
    <Stack spacing={1}>
      <PhoneInput
        country={country}
        onCountryChange={setCountry}
        value={number}
        onChange={(v) => {
          setNumber(v)
          setNotFound(false)
          setError(null)
        }}
        error={error}
        size="small"
        disabled={busy}
        onSubmit={() => void search()}
      />
      {notFound && (
        <Alert severity="info">
          Nobody with this number uses Parley yet. Invite them to sign up with their phone number.
        </Alert>
      )}
      <Button variant="contained" onClick={() => void search()} disabled={busy || !number.trim()}>
        {busy ? <CircularProgress size={20} color="inherit" /> : buttonLabel}
      </Button>
    </Stack>
  )
}
