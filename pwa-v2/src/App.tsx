import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'

// Shared components
import { LogoMark, icons } from './components/Icons'
import WorkoutScreen from './components/WorkoutScreen'
import type { WorkoutState } from './components/WorkoutScreen'

// Pages
import PageHome from './pages/Home'
import PageDashboard from './pages/Dashboard'
import PagePrograms from './pages/Programs'
import PageHistory from './pages/History'
import PageStats from './pages/Stats'
import PageExercises from './pages/Exercises'
import PageMensurations from './pages/Mensurations'
import PageCardio from './pages/Cardio'
import PageReport from './pages/Report'
import PageUpdates from './pages/Updates'
import PageProfile from './pages/Profile'
import PageDefaultPrograms from './pages/DefaultPrograms'

const WORKOUT_STORAGE_KEY = 'ft_active_workout'

// ── Theme switcher config ───────────────────────────────────────────────────
const THEMES = [
  { id: 'dark', label: 'Dark', emoji: '⚡' },
  { id: 'light', label: 'Clair', emoji: '☀️' },
  { id: 'girly', label: 'Egirl', emoji: '🌸' },
  { id: 'stitch', label: 'Stitch', emoji: '🩵' },
]

// ── Nav config ─────────────────────────────────────────────────────────────
const NAV = [
  { page: 'page-home', icon: icons.home, label: 'Accueil' },
  { page: 'page-dashboard', icon: icons.grid, label: 'Tableau de bord' },
  { page: 'page-programs', icon: icons.calendar, label: 'Programmes' },
  { page: 'page-history', icon: icons.list, label: 'Historique' },
  { page: 'page-stats', icon: icons.trend, label: 'Progrès' },
  { page: 'page-mensuration', icon: icons.caliper, label: 'Mensurations' },
  { page: 'page-cardio', icon: icons.flame, label: 'Cardio' },
  { page: 'page-exercises', icon: icons.barbell, label: 'Exercices' },
  { page: 'page-default-programs', icon: icons.spark, label: 'Prog. par défaut' },
]

// ── Auth Screen ────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const blockedMessage = (lockedUntil?: string | null) => {
    if (lockedUntil) {
      const d = new Date(lockedUntil)
      if (!isNaN(d.getTime())) {
        const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        return `Trop de tentatives. Réessaie plus tard (jusqu'à ${heure}).`
      }
    }
    return 'Trop de tentatives. Réessaie plus tard.'
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const identifier = email.trim().toLowerCase()

      // Server-authoritative brute-force gate (Req 6). Degrade open on error.
      try {
        const { data, error: gateError } = await supabase.rpc('check_login_gate', {
          p_identifier: identifier
        })
        if (gateError) {
          // Transient DB/network error: never permanently lock out a legit user (degraded-open).
          console.warn('check_login_gate failed, proceeding (degraded-open):', gateError)
        } else {
          const gate = Array.isArray(data) ? data[0] : data
          if (gate?.blocked === true) {
            setError(blockedMessage(gate?.locked_until))
            setLoading(false)
            return
          }
        }
      } catch (err) {
        console.warn('check_login_gate threw, proceeding (degraded-open):', err)
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Record the failed attempt (best-effort). A write failure must not crash login.
        try {
          const { data: failData, error: failError } = await supabase.rpc('record_login_failure', {
            p_identifier: identifier
          })
          if (failError) {
            console.warn('record_login_failure failed:', failError)
            setError(error.message)
          } else {
            const fail = Array.isArray(failData) ? failData[0] : failData
            if (fail?.blocked === true) {
              setError(blockedMessage(fail?.locked_until))
            } else {
              setError(error.message)
            }
          }
        } catch (err) {
          console.warn('record_login_failure threw:', err)
          setError(error.message)
        }
      } else {
        // Success: reset the counter (best-effort).
        try {
          const { error: successError } = await supabase.rpc('record_login_success', {
            p_identifier: identifier
          })
          if (successError) console.warn('record_login_success failed:', successError)
        } catch (err) {
          console.warn('record_login_success threw:', err)
        }
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } }
      })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" style={{ width: 42, height: 42, borderRadius: 12 }}>
            <LogoMark size={24} />
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em' }}>
              FITNESS<span style={{ color: 'var(--neon)' }}>TRACKER</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>Ton suivi musculation</div>
          </div>
        </div>

        <h2 className="auth-title">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        <p className="auth-sub">{mode === 'login' ? 'Entre tes identifiants pour accéder à ton espace' : 'Rejoins FitnessTracker gratuitement'}</p>

        <div className="auth-error">{error}</div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="field">
              <label>Prénom / Pseudo</label>
              <input type="text" placeholder="Ex: Alex" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="auth-switch">
          <span>{mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}</span>
          <button className="auth-switch-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </div>
        {mode === 'login' && (
          <div className="auth-forgot">
            <button className="auth-forgot-btn">Mot de passe oublié ?</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Password Reset Modal ───────────────────────────────────────────────────
function PasswordResetModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(onClose, 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-raised)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>Nouveau mot de passe</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 16 }}>Choisis un nouveau mot de passe pour ton compte.</p>

        {success ? (
          <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, textAlign: 'center', color: 'var(--neon)', fontWeight: 600 }}>
            Mot de passe mis à jour !
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={{ color: '#ff5555', fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Nouveau mot de passe</label>
              <input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Confirmer</label>
              <input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
              <button type="submit" className="btn-primary btn-sm" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Chargement…' : 'Mettre à jour'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('page-home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workoutState, setWorkoutState] = useState<WorkoutState | null>(null)
  // Séance réduite : l'overlay est masqué mais workoutState reste en mémoire,
  // une barre "Reprendre" est affichée (Point 1 V8.2).
  const [workoutMinimized, setWorkoutMinimized] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)

  const [theme, setTheme] = useState(() => localStorage.getItem('ft_theme') || 'dark')

  // Restore saved workout on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WORKOUT_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as WorkoutState
        if (parsed && parsed.startTs && parsed.exercises) {
          setWorkoutState(parsed)
          setWorkoutMinimized(true)   // restaurée en mode réduit → barre "Reprendre" (Point 1)
        }
      }
    } catch {
      localStorage.removeItem(WORKOUT_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ft_theme', theme)
  }, [theme])

  const cycleTheme = (dir: 1 | -1) => {
    const idx = THEMES.findIndex(t => t.id === theme)
    setTheme(THEMES[(idx + dir + THEMES.length) % THEMES.length].id)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <AuthScreen />

  const PAGE_TITLES: Record<string, string> = {
    'page-home': 'Accueil',
    'page-dashboard': 'Tableau de bord',
    'page-programs': 'Programmes',
    'page-history': 'Historique',
    'page-stats': 'Progrès',
    'page-mensuration': 'Mensurations',
    'page-cardio': 'Cardio & Calories',
    'page-exercises': 'Exercices',
    'page-default-programs': 'Programmes par défaut',
    'page-updates': 'Mises à jour',
    'page-report': 'Signaler',
    'page-profile': 'Mon profil',
  }

  const navigate = (p: string) => { setPage(p); setSidebarOpen(false); }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'

  // Démarre une séance en plein écran (pas réduite).
  const startWorkout = (w: WorkoutState) => { setWorkoutState(w); setWorkoutMinimized(false) }

  const renderPage = () => {
    switch (page) {
      case 'page-home': return <PageHome navigate={navigate} onStartWorkout={startWorkout} />
      case 'page-dashboard': return <PageDashboard navigate={navigate} />
      case 'page-history': return <PageHistory />
      case 'page-stats': return <PageStats />
      case 'page-exercises': return <PageExercises />
      case 'page-programs': return <PagePrograms onStartWorkout={startWorkout} />
      case 'page-updates': return <PageUpdates />
      case 'page-mensuration': return <PageMensurations />
      case 'page-cardio': return <PageCardio />
      case 'page-report': return <PageReport />
      case 'page-profile': return <PageProfile />
      case 'page-default-programs': return <PageDefaultPrograms />
      default: return <PageHome navigate={navigate} />
    }
  }

  return (
    <div className="app-shell">
      {/* sidebar backdrop */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />}

      {/* sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><LogoMark size={20} /></div>
          <div>
            <div className="brand-name">FITNESS<span>TRACKER</span></div>
            <div className="brand-sub">Ton suivi musculation</div>
          </div>
        </div>

        <nav>
          {NAV.map(n => (
            <div key={n.page} className={`nav-item ${page === n.page ? 'active' : ''}`} onClick={() => navigate(n.page)}>
              <span style={{ width: 16, height: 16, display: 'flex', flexShrink: 0 }}>{n.icon}</span>
              {n.label}
            </div>
          ))}
          <div className="nav-eyebrow">Infos</div>
          <div className={`nav-item ${page === 'page-report' ? 'active' : ''}`} onClick={() => navigate('page-report')}>
            <span style={{ width: 16, height: 16, display: 'flex' }}>{icons.flag}</span>Signaler
          </div>
          <div className={`nav-item ${page === 'page-updates' ? 'active' : ''}`} onClick={() => navigate('page-updates')}>
            <span style={{ width: 16, height: 16, display: 'flex' }}>{icons.spark}</span>Mises à jour
          </div>
        </nav>

        <div className="sidebar-spacer" />

        <div className="user-block" onClick={() => navigate('page-profile')}>
          <div className="user-avatar">{displayName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{displayName}</div>
            <div className="user-status"><span className="dot" /><span>En ligne</span></div>
          </div>
          <button className="btn-icon" style={{ width: 28, height: 28, borderRadius: 7 }} onClick={e => { e.stopPropagation(); handleLogout(); }}>
            <span style={{ width: 14, height: 14 }}>{icons.logout}</span>
          </button>
        </div>
      </div>

      {/* main */}
      <div className="main-area">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={() => setSidebarOpen(v => !v)}>
              <span style={{ width: 16, height: 16 }}>{icons.menu}</span>
            </button>
            <div>
              <div className="topbar-title">{PAGE_TITLES[page] || page}</div>
              <div className="topbar-date mono">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => cycleTheme(-1)} className="theme-toggle" title="Thème précédent" style={{ fontSize: 15 }}>‹</button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 9,
              background: 'var(--bg-raised)', border: '1px solid var(--line)', cursor: 'default',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--neon)',
              fontFamily: "'Barlow Condensed', sans-serif", userSelect: 'none',
            }}>
              <span>{THEMES.find(t => t.id === theme)?.emoji}</span>
              <span>{THEMES.find(t => t.id === theme)?.label}</span>
            </div>
            <button onClick={() => cycleTheme(1)} className="theme-toggle" title="Thème suivant" style={{ fontSize: 15 }}>›</button>
          </div>
        </div>

        <div className="content-area">
          <div key={page} className="page active">{renderPage()}</div>
        </div>
      </div>

      {/* FAB home — masqué quand la barre "séance réduite" est visible pour
          éviter le chevauchement en bas d'écran */}
      {page !== 'page-home' && !(workoutState && workoutMinimized) && (
        <button className="home-fab" onClick={() => navigate('page-home')}>
          <span style={{ width: 20, height: 20 }}>{icons.home}</span>
        </button>
      )}

      <div id="toast-area" />

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <PasswordResetModal onClose={() => setShowPasswordReset(false)} />
      )}

      {/* Barre "séance en cours" (mode réduit) — permet de reprendre (Point 1) */}
      {workoutState && workoutMinimized && (
        <button
          className="workout-resume-bar"
          onClick={() => setWorkoutMinimized(false)}
          title="Reprendre la séance"
        >
          <span className="workout-resume-dot" />
          <span className="workout-resume-text">
            <strong>Séance en cours</strong>
            <span>{workoutState.dayName} · {workoutState.progName}</span>
          </span>
          <span className="workout-resume-cta">Reprendre ▸</span>
        </button>
      )}

      {/* Workout Screen overlay — monté seulement quand non réduit */}
      {workoutState && !workoutMinimized && (
        <WorkoutScreen
          workout={workoutState}
          setWorkout={(w) => { setWorkoutState(w); if (w === null) setWorkoutMinimized(false) }}
          onMinimize={() => setWorkoutMinimized(true)}
        />
      )}
    </div>
  )
}
