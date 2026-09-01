import { useState, useEffect } from 'react'
import { TiltCard } from '../components/TiltCard'
import { LogoMark, icons } from '../components/Icons'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const HOME_CARDS = [
  { page: 'page-dashboard', icon: icons.grid, label: 'Tableau de bord' },
  { page: 'page-programs', icon: icons.barbell, label: 'Programmes' },
  { page: 'page-mensuration', icon: icons.caliper, label: 'Mensurations' },
  { page: 'page-stats', icon: icons.trend, label: 'Progrès' },
  { page: 'page-history', icon: icons.list, label: 'Historique' },
  { page: 'page-exercises', icon: icons.spark, label: 'Exercices' },
  { page: 'page-cardio', icon: icons.flame, label: 'Cardio' },
  { page: 'page-report', icon: icons.flag, label: 'Signaler' },
]

interface ProgramDay {
  id?: string
  name: string
  weekdays: number[]
  exercises: { name: string; muscle: string; sets: number; repsTarget: string; restSec: number }[]
}

interface Program {
  id: string
  name: string
  days: ProgramDay[]
}

export default function PageHome({ navigate }: { navigate: (p: string) => void }) {
  const [daysWithSession, setDaysWithSession] = useState<number[]>([])
  const [dayDetails, setDayDetails] = useState<Record<number, ProgramDay[]>>({})
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Get JS day (0=Sunday) converted to our index (0=Monday)
  const jsDay = new Date().getDay()
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1 // Convert: Sun=6, Mon=0, Tue=1, etc.

  useEffect(() => {
    const fetchPrograms = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: programs } = await supabase
        .from('programs')
        .select('*')
        .eq('user_id', user.id)

      const activeDays: number[] = []
      const details: Record<number, ProgramDay[]> = {}

      ;(programs as Program[] | null)?.forEach(p => {
        (p.days || []).forEach((day: ProgramDay) => {
          (day.weekdays || []).forEach((wd: number) => {
            if (!activeDays.includes(wd)) activeDays.push(wd)
            if (!details[wd]) details[wd] = []
            details[wd].push(day)
          })
        })
      })

      setDaysWithSession(activeDays)
      setDayDetails(details)
    }

    fetchPrograms()
  }, [])

  const handleDayClick = (index: number) => {
    if (selectedDay === index) {
      setSelectedDay(null)
    } else {
      setSelectedDay(index)
    }
  }

  return (
    <div className="home-container">
      <div className="home-brand">
        <div className="home-logo-wrap">
          <LogoMark size={44} />
        </div>
        <h1 className="home-title">FITNESS<span>TRACKER</span></h1>
        <p className="home-sub">Ton suivi musculation personnel</p>
      </div>

      <div className="home-weekdays">
        {DAY_LABELS.map((d, i) => (
          <button
            key={i}
            className={`home-day-bubble${daysWithSession.includes(i) ? ' active' : ''}${i === todayIndex ? ' today' : ''}${selectedDay === i ? ' selected' : ''}`}
            onClick={() => handleDayClick(i)}
          >
            {d}
          </button>
        ))}
      </div>

      {/* carte séance du jour sélectionné */}
      {selectedDay !== null && dayDetails[selectedDay] && dayDetails[selectedDay].length > 0 && (
        dayDetails[selectedDay].map((day, idx) => (
          <div key={idx} style={{
            width: '100%', maxWidth: 420, marginBottom: 20, animation: 'fadeSlide .18s ease',
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(var(--neon-rgb),0.25)',
            background: 'var(--bg-panel)',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: 2 }}>
                  {DAY_FULL[selectedDay]}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {day.name}
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 16px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
                Exercices prévus
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(day.exercises || []).map((ex, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--neon)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}

      {selectedDay !== null && (!dayDetails[selectedDay] || dayDetails[selectedDay].length === 0) && (
        <div style={{
          width: '100%', maxWidth: 420, marginBottom: 20, animation: 'fadeSlide .18s ease',
          borderRadius: 14, overflow: 'hidden',
          border: '1px solid var(--line)',
          background: 'var(--bg-panel)',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: 2 }}>
              {DAY_FULL[selectedDay]}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Jour de repos</div>
          </div>
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
            Aucune séance prévue ce jour
          </div>
        </div>
      )}

      <div className="home-grid">
        {HOME_CARDS.map((c, i) => (
          <TiltCard key={i} className="home-card" onClick={() => navigate(c.page)} style={{ padding: '28px 16px', background: 'var(--bg-panel)', border: '1px solid var(--line)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <span className="home-card-icon" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</span>
            <span className="home-card-label">{c.label}</span>
          </TiltCard>
        ))}
      </div>
    </div>
  )
}
