import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import type { CountryCode } from 'libphonenumber-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PhoneInput } from '../components/PhoneInput'
import { LogoMark } from '../components/Logo'
import { formatPhone, guessDefaultCountry, rememberCountry, toE164 } from '../lib/phone'
import { errorMessage } from '../lib/errors'

const RESEND_SECONDS = 30
const isLocalBackend = /127\.0\.0\.1|localhost/.test(import.meta.env.VITE_SUPABASE_URL ?? '')

export default function LoginPage() {
  const { session } = useAuth()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [country, setCountry] = useState<CountryCode>(guessDefaultCountry)
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendIn])

  if (session) return <Navigate to="/" replace />

  const sendCode = async (target = phone) => {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOtp({ phone: target, options: { channel: 'sms' } })
    setBusy(false)
    if (err) {
      setError(errorMessage(err))
      return false
    }
    setResendIn(RESEND_SECONDS)
    return true
  }

  const submitPhone = async () => {
    const e164 = toE164(number, country)
    if (!e164) {
      setError('Enter a valid phone number for the selected country.')
      return
    }
    rememberCountry(country)
    setPhone(e164)
    if (await sendCode(e164)) {
      setCode('')
      setStep('code')
      window.setTimeout(() => codeRef.current?.focus(), 50)
    }
  }

  const verify = async (token = code) => {
    if (token.length !== 6) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    setBusy(false)
    if (err) {
      setError(errorMessage(err))
      setCode('')
      codeRef.current?.focus()
    }
    // On success AuthContext picks up the session and we redirect.
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        background: (t) =>
          `radial-gradient(1200px 600px at 10% -10%, ${t.vars ? `rgba(${t.vars.palette.primary.mainChannel} / 0.18)` : 'transparent'}, transparent 60%), ${t.vars?.palette.background.default}`,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          borderRadius: '24px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 20px 60px -30px rgba(15, 23, 42, 0.35)',
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <LogoMark size={56} />
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {step === 'phone' ? 'Sign in to Parley' : 'Enter the code'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step === 'phone' ? (
                'Use your phone number. We will text you a 6-digit code — no passwords.'
              ) : (
                <>
                  We sent an SMS to <strong>{formatPhone(phone)}</strong>
                </>
              )}
            </Typography>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {step === 'phone' ? (
            <Stack
              spacing={1}
              component="form"
              onSubmit={(e) => {
                e.preventDefault()
                void submitPhone()
              }}
            >
              <PhoneInput
                country={country}
                onCountryChange={setCountry}
                value={number}
                onChange={setNumber}
                autoFocus
                disabled={busy}
                onSubmit={() => void submitPhone()}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy || !number.trim()}>
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Continue'}
              </Button>
            </Stack>
          ) : (
            <Stack
              spacing={2}
              component="form"
              onSubmit={(e) => {
                e.preventDefault()
                void verify()
              }}
            >
              <TextField
                inputRef={codeRef}
                label="6-digit code"
                value={code}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(next)
                  if (next.length === 6) void verify(next)
                }}
                slotProps={{
                  htmlInput: {
                    inputMode: 'numeric',
                    autoComplete: 'one-time-code',
                    maxLength: 6,
                    'aria-label': 'Verification code',
                    style: { letterSpacing: '0.6em', textAlign: 'center', fontSize: 24, fontWeight: 600 },
                  },
                }}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy || code.length !== 6}>
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Verify'}
              </Button>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => {
                    setStep('phone')
                    setError(null)
                  }}
                >
                  Wrong number?
                </Link>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  disabled={resendIn > 0 || busy}
                  onClick={() => void sendCode()}
                  sx={{ '&[disabled]': { color: 'text.disabled', cursor: 'default', textDecoration: 'none' } }}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </Link>
              </Stack>
            </Stack>
          )}

          {isLocalBackend && (
            <Alert severity="info" variant="outlined" sx={{ fontSize: 13 }}>
              Local dev: use test numbers <strong>+1 201 555 0100</strong> to <strong>0103</strong> with code{' '}
              <strong>123456</strong>.
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
            <LockRoundedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">Your chats are visible only to their members.</Typography>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}
