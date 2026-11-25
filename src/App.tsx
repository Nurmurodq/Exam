import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { isSupabaseConfigured } from './lib/supabase'
import { EmptyChatPane } from './components/EmptyChatPane'
import { ChatRoute } from './components/chat/ChatView'
import { LogoMark } from './components/Logo'

// Static hosts without SPA rewrites (e.g. a Render static site created via API) can set
// VITE_ROUTER_MODE=hash so deep links like /#/c/<id> survive a page refresh.
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter

const LoginPage = lazy(() => import('./pages/LoginPage'))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'))
const MessengerLayout = lazy(() => import('./pages/MessengerLayout'))

function Splash() {
  return (
    <Box sx={{ height: '100dvh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
        <LogoMark size={64} />
        <CircularProgress size={24} />
      </Box>
    </Box>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || !profile.display_name) return <ProfileSetupPage />
  return <>{children}</>
}

function MissingConfig() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 520, borderRadius: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Supabase is not configured
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          This copy of Parley is not connected to a Supabase backend yet.
        </Typography>
        <Typography color="text.secondary">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> — in <code>.env.local</code> for
          local development, or in your hosting provider’s environment settings — and rebuild. See the README.
        </Typography>
      </Paper>
    </Box>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfig />
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <MessengerLayout />
                </RequireAuth>
              }
            >
              <Route index element={<EmptyChatPane />} />
              <Route path="c/:conversationId" element={<ChatRoute />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  )
}
