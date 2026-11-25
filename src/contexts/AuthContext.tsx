import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'about' | 'avatar_path'>>

interface AuthContextValue {
  session: Session | null
  userId: string | null
  profile: Profile | null
  /** True until the initial session (and profile, if signed in) has loaded. */
  loading: boolean
  refreshProfile: () => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null)

  const userId = session?.user.id ?? null

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setSessionLoaded(true)
    })
    // Note: never await other supabase calls inside this callback.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionLoaded(true)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, phone, display_name, about, avatar_path, last_seen_at')
      .eq('id', id)
      .maybeSingle()
    if (error) console.error('Failed to load profile', error)
    setProfile((data as Profile | null) ?? null)
    setProfileLoadedFor(id)
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoadedFor(null)
      return
    }
    void fetchProfile(userId)
  }, [userId, fetchProfile])

  const refreshProfile = useCallback(async () => {
    if (userId) await fetchProfile(userId)
  }, [userId, fetchProfile])

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('id, phone, display_name, about, avatar_path, last_seen_at')
        .single()
      if (error) throw error
      setProfile(data as Profile)
    },
    [userId],
  )

  const signOut = useCallback(async () => {
    await supabase.removeAllChannels()
    await supabase.auth.signOut()
  }, [])

  const loading = !sessionLoaded || (userId !== null && profileLoadedFor !== userId)

  const value = useMemo<AuthContextValue>(
    () => ({ session, userId, profile, loading, refreshProfile, updateProfile, signOut }),
    [session, userId, profile, loading, refreshProfile, updateProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
