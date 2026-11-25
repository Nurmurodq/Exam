import { useMemo } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { COUNTRIES, formatAsYouType, type CountryOption } from '../lib/phone'

interface PhoneInputProps {
  country: CountryCode
  onCountryChange: (country: CountryCode) => void
  value: string
  onChange: (value: string) => void
  error?: string | null
  disabled?: boolean
  autoFocus?: boolean
  onSubmit?: () => void
  label?: string
  size?: 'small' | 'medium'
}

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChange,
  error,
  disabled,
  autoFocus,
  onSubmit,
  label = 'Phone number',
  size = 'medium',
}: PhoneInputProps) {
  const selected = useMemo(() => COUNTRIES.find((c) => c.code === country) ?? null, [country])

  const handleNumberChange = (raw: string) => {
    // Pasting a full international number (e.g. "+44 20 7946 0958") switches the country.
    if (raw.trim().startsWith('+')) {
      const parsed = parsePhoneNumberFromString(raw)
      if (parsed?.country) {
        onCountryChange(parsed.country)
        onChange(formatAsYouType(parsed.nationalNumber, parsed.country))
        return
      }
    }
    const cleaned = raw.replace(/[^\d\s()-]/g, '')
    // Let users delete formatting characters naturally.
    const digits = cleaned.replace(/\D/g, '')
    const prevDigits = value.replace(/\D/g, '')
    if (digits === prevDigits && cleaned.length < value.length) {
      onChange(formatAsYouType(digits.slice(0, -1), country))
      return
    }
    onChange(formatAsYouType(digits, country))
  }

  return (
    <Stack spacing={1.5}>
      <Autocomplete<CountryOption, false, true>
        options={COUNTRIES}
        value={selected ?? undefined}
        disableClearable
        disabled={disabled}
        size={size}
        autoHighlight
        onChange={(_, option) => option && onCountryChange(option.code)}
        getOptionLabel={(o) => `${o.flag} ${o.name}`}
        filterOptions={(options, state) => {
          const q = state.inputValue.trim().toLowerCase().replace(/^\+/, '')
          if (!q) return options
          return options.filter(
            (o) =>
              o.name.toLowerCase().includes(q) ||
              o.code.toLowerCase() === q ||
              o.dialCode.replace('+', '').startsWith(q),
          )
        }}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        renderOption={(props, option) => {
          const { key, ...rest } = props as typeof props & { key: string }
          return (
            <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.5 }}>
              <span style={{ fontSize: 20 }}>{option.flag}</span>
              <Box sx={{ flex: 1 }}>{option.name}</Box>
              <Box sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{option.dialCode}</Box>
            </Box>
          )
        }}
        renderInput={(params) => <TextField {...params} label="Country" />}
      />
      <TextField
        label={label}
        value={value}
        size={size}
        disabled={disabled}
        autoFocus={autoFocus}
        error={Boolean(error)}
        helperText={error || ' '}
        onChange={(e) => handleNumberChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit?.()
          }
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {selected?.dialCode}
              </InputAdornment>
            ),
          },
          htmlInput: {
            inputMode: 'tel',
            autoComplete: 'tel-national',
            'aria-label': label,
            name: 'phone',
          },
        }}
      />
    </Stack>
  )
}
