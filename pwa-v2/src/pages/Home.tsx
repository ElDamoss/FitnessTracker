import { useState, useEffect } from 'react'
import { TiltCard } from '../components/TiltCard'
import { LogoMark, icons } from '../components/Icons'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

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
            className={`home-day-bubble${daysWithSession.includes(i) ? ' active' : ''}${i === todayIndex ? ' today' : ''}`}
            onClick={() => handleDayClick(i)}
          >
            {d}
          </button>
        ))}
      </div>

      {selectedDay !== null && dayDetails[selectedDay] && dayDetails[selectedDay].length > 0 && (
        <TiltCard className="home-day-card">
          <h3 className="home-day-card-title">
            Séances du {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][selectedDay]}
          </h3>
          {dayDetails[selectedDay].map((day, idx) => (
            <div key={idx} className="home-day-session">
              <div className="home-day-session-name">{day.name}</div>
            </div>
          ))}
        </TiltCard>
      )}

      {selectedDay !== null && (!dayDetails[selectedDay] || dayDetails[selectedDay].length === 0) && (
        <TiltCard className="home-day-card">
          <p className="home-day-empty">
            Aucune séance prévue ce jour
          </p>
        </TiltCard>
      )}

      <div className="home-grid">
        {HOME_CARDS.map((c, i) => (
          <TiltCard key={i} className="home-card" style={{ padding: '28px 16px', background: 'var(--bg-panel)', border: '1px solid var(--line)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <button onClick={() => navigate(c.page)} style={{ display: 'contents' }}>
              <span className="home-card-icon" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</span>
              <span className="home-card-label">{c.label}</span>
            </button>
          </TiltCard>
        ))}
      </div>
    </div>
  )
}
