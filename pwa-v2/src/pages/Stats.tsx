import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

interface SessionData {
  id: string
  date: string
  name: string
  cardio?: boolean
  type?: string
  exercises?: Array<{
    name: string
    muscle?: string
    sets: Array<{ weight?: string; reps?: string }>
  }>
}

function SimpleLineChart({ data }: { data: { x: string; y: number }[] }) {
  if (data.length < 2) return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>Pas assez de données</div>

  const maxY = Math.max(...data.map(d => d.y))
  const minY = Math.min(...data.map(d => d.y))
  const W = 500, H = 160, padX = 40, padY = 20
  const range = maxY - minY || 1

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (W - padX * 2)
    const y = H - padY - ((d.y - minY) / range) * (H - padY * 2)
    return { x, y, label: d.x, value: d.y }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Gradient area
  const areaD = pathD + ` L ${points[points.length - 1].x} ${H - padY} L ${points[0].x} ${H - padY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--neon)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--neon)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = H - padY - f * (H - padY * 2)
        const val = Math.round(minY + f * range)
        return (
          <g key={f}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--line)" strokeWidth="0.5" />
            <text x={padX - 5} y={y + 3} fontSize="8" fill="var(--ink-faint)" textAnchor="end">{val}</text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#lineGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--neon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--neon)" />
      ))}

      {/* X labels (show first, middle, last) */}
      {[0, Math.floor(points.length / 2), points.length - 1].map(i => (
        <text key={i} x={points[i].x} y={H - 4} fontSize="8" fill="var(--ink-faint)" textAnchor="middle">
          {points[i].label}
        </text>
      ))}
    </svg>
  )
}

export default function PageStats() {
  const [period, setPeriod] = useState('90')
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [exercises, setExercises] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    const allSessions = (data || []).filter((s: SessionData) => s.type !== 'cardio' && !s.cardio)
    setSessions(allSessions)

    // Extract unique exercise names
    const exNames = new Set<string>()
    allSessions.forEach((s: SessionData) => {
      ;(s.exercises || []).forEach(ex => exNames.add(ex.name))
    })
    const sorted = Array.from(exNames).sort()
    setExercises(sorted)
    if (sorted.length > 0 && !selectedExercise) setSelectedExercise(sorted[0])
    setLoading(false)
  }

  // Filter sessions by period
  const now = new Date()
  const periodDays = parseInt(period)
  const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
  const filteredSessions = periodDays >= 9999
    ? sessions
    : sessions.filter(s => new Date(s.date) >= cutoff)

  // Build chart data for selected exercise (max weight per session)
  const chartData: { x: string; y: number }[] = []
  filteredSessions.forEach(s => {
    const ex = (s.exercises || []).find(e => e.name === selectedExercise)
    if (!ex) return
    let maxW = 0
    ;(ex.sets || []).forEach(st => {
      const w = parseFloat(st.weight || '0') || 0
      if (w > maxW) maxW = w
    })
    if (maxW > 0) {
      const d = new Date(s.date)
      chartData.push({ x: `${d.getDate()}/${d.getMonth() + 1}`, y: maxW })
    }
  })

  // Build reps chart data for selected exercise (MAX single-set reps per session — never a sum)
  const repsChartData: { x: string; y: number }[] = []
  let maxRepsOverall = 0
  filteredSessions.forEach(s => {
    const ex = (s.exercises || []).find(e => e.name === selectedExercise)
    if (!ex) return
    let maxReps = 0
    ;(ex.sets || []).forEach(st => {
      const r = parseInt(st.reps || '0') || 0
      if (r > maxReps) maxReps = r
    })
    if (maxReps > 0) {
      if (maxReps > maxRepsOverall) maxRepsOverall = maxReps
      const d = new Date(s.date)
      repsChartData.push({ x: `${d.getDate()}/${d.getMonth() + 1}`, y: maxReps })
    }
  })

  // Build personal records (top weight for each exercise across all sessions)
  const records: { name: string; muscle: string; pr: number }[] = []
  const prMap: Record<string, { muscle: string; weight: number }> = {}
  sessions.forEach(s => {
    ;(s.exercises || []).forEach(ex => {
      ;(ex.sets || []).forEach(st => {
        const w = parseFloat(st.weight || '0') || 0
        if (w > 0) {
          if (!prMap[ex.name] || w > prMap[ex.name].weight) {
            prMap[ex.name] = { muscle: ex.muscle || '', weight: w }
          }
        }
      })
    })
  })
  Object.entries(prMap)
    .sort((a, b) => b[1].weight - a[1].weight)
    .forEach(([name, { muscle, weight }]) => {
      records.push({ name, muscle, pr: weight })
    })

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-h1 display">Progrès</h2>
        </div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-faint)' }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Progrès</h2>
      </div>
      <div className="stats-filters">
        <select
          className="select-sm"
          style={{ flex: 1 }}
          value={selectedExercise}
          onChange={e => setSelectedExercise(e.target.value)}
        >
          <option value="">Exercice…</option>
          {exercises.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-raised)', borderRadius: 8, padding: 4 }}>
          {[['30', '30j'], ['90', '3m'], ['365', '1an'], ['9999', 'Tout']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: period === v ? 'var(--neon)' : 'transparent',
              color: period === v ? '#0a0c0f' : 'var(--ink-dim)',
              fontSize: 11, fontWeight: 700, fontFamily: "'Barlow', sans-serif", transition: 'all .15s',
            }}>{l}</button>
          ))}
        </div>
      </div>

      <TiltCard style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div className="panel-head"><div className="panel-title">Charge max — {selectedExercise || 'Sélectionner un exercice'}</div></div>
        <SimpleLineChart data={chartData} />
      </TiltCard>

      <TiltCard style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div className="panel-head"><div className="panel-title">Reps max (série) — {selectedExercise || 'Sélectionner un exercice'}</div></div>
        {repsChartData.length === 0 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>
            Aucune donnée de répétitions.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon)', fontFamily: "'Barlow', sans-serif" }}>{maxRepsOverall}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>reps max sur la période</span>
            </div>
            <SimpleLineChart data={repsChartData} />
          </>
        )}
      </TiltCard>

      <div className="section-label">Records personnels</div>
      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--ink-faint)', fontSize: 13 }}>
          Aucun record enregistré
        </div>
      ) : (
        <div className="pr-grid">
          {records.map((ex, i) => (
            <TiltCard key={i} className="pr-card-stat">
              <div className="pr-card-ex">{ex.name}</div>
              <div className="pr-card-val">{ex.pr} kg</div>
              <div className="pr-card-meta">{ex.muscle}</div>
            </TiltCard>
          ))}
        </div>
      )}
    </div>
  )
}
