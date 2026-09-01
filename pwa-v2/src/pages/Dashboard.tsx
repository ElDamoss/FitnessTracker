import { useState, useEffect } from 'react'
import { TiltCard } from '../components/TiltCard'
import { icons } from '../components/Icons'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

interface SessionRow {
  id: string
  user_id: string
  name: string
  date: string
  duration_sec: number
  exercises: { name: string; muscle: string; sets: { weight: number; reps: number; rpe?: number }[] }[]
  cardio?: boolean
}

function sesVol(s: SessionRow): number {
  let vol = 0
  ;(s.exercises || []).forEach((ex) => {
    ;(ex.sets || []).forEach((st) => {
      vol += (parseFloat(String(st.weight)) || 0) * (parseInt(String(st.reps)) || 0)
    })
  })
  return vol
}

function formatVol(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')} t`
  return `${Math.round(v)} kg`
}

function formatDuration(sec: number): string {
  const m = Math.round(sec / 60)
  return `${m} min`
}

function getWeekVolumes(sessions: SessionRow[]): number[] {
  const today = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7 // Monday=0
  const volumes: number[] = [0, 0, 0, 0, 0, 0, 0]

  for (const s of sessions) {
    const sDate = new Date(s.date)
    const diffMs = today.getTime() - sDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const sessionDayOfWeek = (sDate.getDay() + 6) % 7

    // Only include sessions from the current week (Mon-Sun)
    if (diffDays >= 0 && diffDays <= dayOfWeek) {
      volumes[sessionDayOfWeek] += sesVol(s)
    }
  }
  return volumes
}

function getActiveDays(sessions: SessionRow[]): number[] {
  const today = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7
  const active = new Set<number>()

  for (const s of sessions) {
    const sDate = new Date(s.date)
    const diffMs = today.getTime() - sDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const sessionDayOfWeek = (sDate.getDay() + 6) % 7

    if (diffDays >= 0 && diffDays <= dayOfWeek) {
      active.add(sessionDayOfWeek)
    }
  }
  return Array.from(active)
}

function computeStreak(sessions: SessionRow[]): number {
  if (sessions.length === 0) return 0
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse()
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().slice(0, 10)
    if (dates.includes(expectedStr)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function sessionsThisMonth(sessions: SessionRow[]): number {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return sessions.filter(s => {
    const d = new Date(s.date)
    return d.getFullYear() === y && d.getMonth() === m
  }).length
}

function WeekChart({ volumes }: { volumes: number[] }) {
  const today = (new Date().getDay() + 6) % 7
  const max = Math.max(...volumes)
  return (
    <div className="chart-wrap">
      {volumes.map((v, i) => (
        <div key={i} className="chart-col">
          <div className="chart-bar-wrap">
            <div className={`chart-bar ${i === today ? 'today' : ''}`} style={{ height: max > 0 ? `${(v / max) * 100}%` : '0%', minHeight: v > 0 ? 4 : 0 }} />
          </div>
          <div className={`chart-day ${i === today ? 'today' : ''}`}>{DAY_LABELS[i]}</div>
        </div>
      ))}
    </div>
  )
}

export default function PageDashboard({ navigate }: { navigate: (p: string) => void }) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('cardio', false)
        .order('date', { ascending: false })
        .limit(20)

      setSessions((data as SessionRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const weekVolumes = getWeekVolumes(sessions)
  const activeDays = getActiveDays(sessions)
  const streak = computeStreak(sessions)
  const monthSessions = sessionsThisMonth(sessions)
  const weekTotal = weekVolumes.reduce((a, b) => a + b, 0)
  const recentSessions = sessions.slice(0, 5)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      {/* Hero banner */}
      <TiltCard style={{ marginBottom: 16, padding: 0, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ position: 'relative', padding: '28px 28px', background: 'linear-gradient(135deg, var(--bg-panel), var(--bg-raised))' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, var(--neon-soft) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon)', boxShadow: '0 0 6px var(--neon)', display: 'inline-block' }} />
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, lineHeight: 1.15, marginBottom: 6 }}>
            Bon entraînement,<br /><span style={{ color: 'var(--neon)' }}>Champion</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 20 }}>
            {streak > 0 ? `Série de ${streak} jour${streak > 1 ? 's' : ''} actif${streak > 1 ? 's' : ''}` : 'Commence une série !'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={() => navigate('page-programs')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14 }}>{icons.play}</span> Lancer une séance
            </button>
            <button className="btn-ghost" onClick={() => navigate('page-history')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14 }}>{icons.note}</span> Voir l'historique
            </button>
          </div>
        </div>
      </TiltCard>

      {/* Stats */}
      <div className="row-3">
        {[
          { icon: icons.barbell, label: 'Séances ce mois', value: String(monthSessions), delta: monthSessions > 0 ? `${monthSessions} ce mois` : null },
          { icon: icons.flame, label: 'Régularité', value: `${streak}j`, delta: null },
          { icon: icons.trend, label: 'Volume — 7j', value: formatVol(weekTotal), delta: null },
        ].map((s, i) => (
          <TiltCard key={i} className="stat-card">
            <div className="stat-top">
              <div className="stat-icon"><span style={{ width: 15, height: 15, display: 'flex' }}>{s.icon}</span></div>
              {s.delta
                ? <span className="stat-delta">{s.delta}</span>
                : <span className="stat-delta neutral">—</span>
              }
            </div>
            <div className="stat-value mono">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </TiltCard>
        ))}
      </div>

      {/* Week bubbles */}
      <TiltCard style={{ marginBottom: 16, padding: '18px 20px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 12 }}>Cette semaine</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {DAY_LABELS.map((d, i) => {
            const isToday = i === (new Date().getDay() + 6) % 7
            const isActive = activeDays.includes(i)
            return (
              <div key={i} style={{
                width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15,
                background: isActive ? 'var(--neon)' : 'var(--bg-raised)',
                color: isActive ? '#0a0c0f' : 'var(--ink-faint)',
                border: isToday && !isActive ? '1px solid var(--neon)' : '1px solid var(--line)',
                boxShadow: isActive ? '0 4px 10px var(--neon-soft)' : 'none',
              }}>{d}</div>
            )
          })}
        </div>
      </TiltCard>

      {/* Charts + recent */}
      <div className="row-split">
        <TiltCard style={{ padding: '18px 20px' }}>
          <div className="panel-head"><div className="panel-title">Volume hebdomadaire</div></div>
          <WeekChart volumes={weekVolumes} />
        </TiltCard>
        <TiltCard style={{ padding: '18px 20px' }}>
          <div className="panel-head">
            <div className="panel-title">Dernières séances</div>
            <button onClick={() => navigate('page-history')} style={{ fontSize: 11, color: 'var(--neon)', fontWeight: 600 }}>Voir tout</button>
          </div>
          {recentSessions.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '12px 0' }}>Aucune séance enregistrée</div>
          )}
          {recentSessions.map((s, i) => (
            <div key={i} className="session-row">
              <div className="session-badge">{new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div>
              <div style={{ flex: 1 }}>
                <div className="session-name">{s.name}</div>
                <div className="session-meta">{(s.exercises || []).length} exos · {formatDuration(s.duration_sec)}</div>
              </div>
              <div className="session-vol-val">{Math.round(sesVol(s)).toLocaleString('fr-FR')} kg</div>
            </div>
          ))}
        </TiltCard>
      </div>
    </div>
  )
}
