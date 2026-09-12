import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Fleet from './pages/Fleet'
import Staff from './pages/Staff'
import RoutesPage from './pages/Routes'
import Tracker from './pages/Tracker'
import Clients from './pages/Clients'
import Finances from './pages/Finances'
import Settings from './pages/Settings'
import Driver from './pages/Driver'

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
}

/**
 * `allowDriver=false` routes (the full CRM) bounce a driver-role login to
 * /driver instead — drivers get the mobile trip/photo page, not the full
 * back-office UI. Every other role passes straight through.
 */
function RequireAuth({ children, allowDriver = true }: { children: ReactNode; allowDriver?: boolean }) {
  const { session, loading, staff, staffLoading } = useAuth()
  if (loading || (session && staffLoading)) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!allowDriver && staff?.role === 'driver') return <Navigate to="/driver" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { session, loading, staff, staffLoading } = useAuth()
  if (loading || (session && staffLoading)) return <LoadingScreen />
  // Already signed in (e.g. just completed sign-in, or an existing session was
  // restored on load) — leave the login page instead of sitting on it forever.
  if (session) return <Navigate to={staff?.role === 'driver' ? '/driver' : '/'} replace />
  return <Login />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/driver"
        element={
          <RequireAuth>
            <Driver />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth allowDriver={false}>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
