import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Staff } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  /** The staff record linked to this login (matched by email), if any. */
  staff: Staff | null
  /** True while we're still looking up the staff record for a signed-in user. */
  staffLoading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [staffLoading, setStaffLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // A driver's login is linked to their staff record by matching email —
  // there's no separate "user_id" column, so whoever creates a driver's
  // Supabase Auth account must set their staff record's email to match it
  // exactly (see README). This also drives the post-login redirect (drivers
  // land on /driver instead of the full CRM).
  useEffect(() => {
    const email = session?.user?.email
    if (!email) {
      setStaff(null)
      setStaffLoading(false)
      return
    }
    let cancelled = false
    setStaffLoading(true)
    supabase
      .from('staff')
      .select('*')
      .ilike('email', email)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setStaff((data as Staff | null) ?? null)
        setStaffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user?.email])

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        staff,
        staffLoading,
        signInWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
