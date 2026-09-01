import { useState, useEffect } from 'react'
import { TiltCard } from '../components/TiltCard'
import { LogoMark, icons } from '../components/Icons'
import { supabase } from '../lib/supabase'
import type { WorkoutState, WorkoutExercise, WorkoutSet } from '../components/WorkoutScreen'

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

// Full exercise shape as persisted by the program editor (ModalNewProgram).
// Kept optional-tolerant so legacy/simple rows still work.
interface ProgramExercise {
  id?: string
  name: string
  muscle: string
  sets: number
  repsTarget?: string
  restSec?: number
  tempo?: string
  mode?: 'reps' | 'time'
  time?: string
  rpeEnabled?: boolean
  rpe?: string
}

interface ProgramDay {
  id?: string
  name: string
  weekdays: number[]
  exercises: ProgramExercise[]
}

interface Program {
  id: string
  name: string
  days: ProgramDay[]
}

// A day paired with its owning program, so we can launch it correctly.
interface DayEntry {
  program: Program
  day: ProgramDay
  dayIndex: number
}

// Cardio muscles filtered out of a muscu workout (mirrors Programs.tsx §7).
const CARDIO_MUSCLES = ['cardio', 'course', 'vélo', 'rameur', 'elliptique', 'corde à sauter']
function isCardioExercise(muscle: string): boolean {
  return CARDIO_MUSCLES.some(c => (muscle || '').toLowerCase().includes(c))
}

function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  const area = document.getElementById('toast-area')
  if (!area) return
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  area.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

// Estimation de la durée d'une séance, affichée en fourchette (ex: "50-60 min").
// Modèle simple : par série on compte le temps de repos + un temps d'effort
// forfaitaire (~40s), le tout borné en bas/haut pour donner une fourchette.
function estimateDuration(exercises: ProgramExercise[]): string {
  const muscu = exercises.filter(ex => !isCardioExercise(ex.muscle))
  let totalSec = 0
  for (const ex of muscu) {
    const sets = ex.sets || 3
    const rest = ex.restSec || 90
    const effort = 40 // temps d'exécution approximatif par série (s)
    totalSec += sets * (rest + effort)
  }
  if (totalSec === 0) return ''
  const minutes = totalSec / 60
  const low = Math.max(5, Math.round((minutes * 0.9) / 5) * 5)
  const high = Math.round((minutes * 1.1) / 5) * 5
  return low === high ? `${low} min` : `${low}-${high} min`
}

interface PageHomeProps {
  navigate: (p: string) => void
  onStartWorkout?: (workout: WorkoutState) => void
}

export default function PageHome({ navigate, onStartWorkout }: PageHomeProps) {
  const [daysWithSession, setDaysWithSession] = useState<number[]>([])
  const [dayDetails, setDayDetails] = useState<Record<number, DayEntry[]>>({})
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [libraryTypes, setLibraryTypes] = useState<Record<string, 'reps' | 'seconds'>>({})

  // Get JS day (0=Sunday) converted to our index (0=Monday)
  const jsDay = new Date().getDay()
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1 // Sun=6, Mon=0, Tue=1, …

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Exercise library measurement types (used to init workout measurementType)
      const { data: exRows } = await supabase
        .from('exercises')
        .select('name, set_measurement_type')
      const typeMap: Record<string, 'reps' | 'seconds'> = {}
      ;(exRows as { name: string; set_measurement_type?: string }[] | null)?.forEach(e => {
        typeMap[e.name] = e.set_measurement_type === 'seconds' ? 'seconds' : 'reps'
      })
      setLibraryTypes(typeMap)

      const { data: programs } = await supabase
        .from('programs')
        .select('*')
        .eq('user_id', user.id)

      const activeDays: number[] = []
      const details: Record<number, DayEntry[]> = {}

      ;(programs as Program[] | null)?.forEach(p => {
        (p.days || []).forEach((day, dayIndex) => {
          (day.weekdays || []).forEach((wd: number) => {
            if (!activeDays.includes(wd)) activeDays.push(wd)
            if (!details[wd]) details[wd] = []
            details[wd].push({ program: p, day, dayIndex })
          })
        })
      })

      setDaysWithSession(activeDays)
      setDayDetails(details)
    }

    fetchData()
  }, [])

  const handleDayClick = (index: number) => {
    setSelectedDay(cur => (cur === index ? null : index))
  }

  // Build a WorkoutState from a program day and hand it to App (same logic as
  // Programs.launchDay §7: cardio filtered out, mode/time/rpeEnabled mapped).
  const launchDay = (entry: DayEntry) => {
    if (!onStartWorkout) return
    const { program: p, day, dayIndex: di } = entry

    const cardioExs = (day.exercises || []).filter(ex => isCardioExercise(ex.muscle))
    const muscuExs = (day.exercises || []).filter(ex => !isCardioExercise(ex.muscle))

    if (cardioExs.length > 0) {
      showToast(`${cardioExs.length} exo(s) cardio ignoré(s) — fais-les séparément !`, 'info')
    }
    if (muscuExs.length === 0) {
      showToast('Aucun exercice muscu dans ce jour', 'error')
      return
    }

    const workoutExercises: WorkoutExercise[] = muscuExs.map(ex => {
      const measurementType: 'reps' | 'seconds' =
        ex.mode === 'time' ? 'seconds' : (libraryTypes[ex.name] || 'reps')
      return {
        name: ex.name,
        muscle: ex.muscle,
        restSec: ex.restSec || 90,
        completed: false,
        measurementType,
        tempo: ex.tempo,
        rpeEnabled: ex.rpeEnabled,
        sets: Array.from({ length: ex.sets || 3 }, (): WorkoutSet => ({
          weight: '',
          reps: ex.repsTarget || '',
          duration: measurementType === 'seconds' ? (ex.time || '') : '',
          rpe: '',
          done: false,
          restLeft: 0,
          restPaused: false,
        })),
      }
    })

    onStartWorkout({
      progId: p.id,
      dayId: day.id || `day-${di}`,
      dayName: day.name || `Jour ${di + 1}`,
      progName: p.name,
      startTs: Date.now(),
      exercises: workoutExercises,
    })
  }

  const selectedEntries = selectedDay !== null ? (dayDetails[selectedDay] || []) : []

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

      {/* cartes séance(s) du jour sélectionné */}
      {selectedDay !== null && selectedEntries.length > 0 && (
        selectedEntries.map((entry, idx) => {
          const day = entry.day
          const muscuCount = (day.exercises || []).filter(ex => !isCardioExercise(ex.muscle)).length
          const duration = estimateDuration(day.exercises || [])
          return (
            <div key={day.id || idx} style={{
              width: '100%', maxWidth: 420, marginBottom: 14, animation: 'fadeSlide .18s ease',
              borderRadius: 14, overflow: 'hidden',
              border: '1px solid rgba(var(--neon-rgb),0.25)',
              background: 'var(--bg-panel)',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: 2 }}>
                    {DAY_FULL[selectedDay]} · {entry.program.name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {day.name || `Jour ${entry.dayIndex + 1}`}
                  </div>
                </div>
                {duration && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                    {duration}
                  </div>
                )}
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

                {/* Bouton lancer la séance */}
                {onStartWorkout && muscuCount > 0 && (
                  <button
                    className="btn-train"
                    style={{ width: '100%', marginTop: 14, padding: '11px 16px', fontSize: 13 }}
                    onClick={() => launchDay(entry)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg>
                    Lancer la séance
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}

      {selectedDay !== null && selectedEntries.length === 0 && (
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
