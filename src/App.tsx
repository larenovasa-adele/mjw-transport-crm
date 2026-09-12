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

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
    )
  }
  // Already signed in (e.g. just completed sign-in, or an existing session was
  // restored on load) — leave the login page instead of sitting on it forever.
  if (session) return <Navigate to="/" replace />
  return <Login />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        element={
          <RequireAuth>
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
