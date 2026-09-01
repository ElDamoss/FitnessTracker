import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────
export interface WorkoutSet {
  weight: string
  reps: string          // used when measurementType === 'reps'
  duration: string      // seconds value, used when measurementType === 'seconds'
  rpe: string
  done: boolean
  restLeft: number
  restPaused: boolean
}

export interface WorkoutExercise {
  name: string
  muscle: string
  restSec: number
  completed: boolean
  measurementType: 'reps' | 'seconds'   // defaulted from exercise.set_measurement_type
  tempo?: string                        // free text from program exercise
  comment?: string                      // per-exercise note
  sets: WorkoutSet[]
}

export interface UsualWeightRow {
  date: string
  weight: string
  reps?: string
  duration?: string
}

// A row from the exercise library (`exercises` table) used by the swap picker (Req 7)
export interface LibraryExercise {
  id: string
  name: string
  muscle: string
  set_measurement_type?: 'reps' | 'seconds'
}

// Muscle-chip filter values, mirroring the pattern used in Exercises.tsx
const SWAP_MUSCLES = ['Tous', 'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Fessiers', 'Abdos', 'Cardio']

export interface WorkoutState {
  progId: string
  dayId: string
  dayName: string
  progName: string
  startTs: number
  exercises: WorkoutExercise[]
}

const STORAGE_KEY = 'ft_active_workout'

// ── Normalization ───────────────────────────────────────────────────────────
// Legacy `ft_active_workout` states and incoming workout props may lack the
// V8 fields (measurementType, duration, tempo, comment). Backfill defensive
// defaults so the rest of the component can rely on them being present.
function normalizeExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return (exercises ?? []).map(ex => ({
    ...ex,
    measurementType: ex.measurementType === 'seconds' ? 'seconds' : 'reps',
    tempo: ex.tempo,
    comment: ex.comment,
    sets: (ex.sets ?? []).map(set => ({
      weight: set.weight ?? '',
      reps: set.reps ?? '',
      duration: set.duration ?? '',
      rpe: set.rpe ?? '',
      done: set.done ?? false,
      restLeft: set.restLeft ?? 0,
      restPaused: set.restPaused ?? false,
    })),
  }))
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Query the user's recent session history for sets recorded under `name`
// (the exercise's CURRENT name). Flattens all matching sets across the last
// 30 sessions. Returns [] on any error or when there is no history. (Req 3)
export async function queryUsualWeights(name: string): Promise<UsualWeightRow[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('sessions')
      .select('date, exercises')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30)
    if (error) return []
    const out: UsualWeightRow[] = []
    for (const s of (data ?? []) as { date: string; exercises?: { name?: string; sets?: { weight?: string; reps?: string; duration?: string }[] }[] }[]) {
      for (const ex of (s.exercises ?? [])) {
        if (ex.name === name) {                    // keyed on current exercise NAME (Req 3.2)
          for (const st of (ex.sets ?? [])) {
            out.push({ date: s.date, weight: st.weight ?? '', reps: st.reps, duration: st.duration })
          }
        }
      }
    }
    return out                                     // [] → panel shows "no history" (Req 3.5)
  } catch {
    return []
  }
}

// Query the exercise library for the swap picker. Selects only the fields the
// picker needs. Returns [] on error. (Req 7.2)
export async function queryLibrary(): Promise<LibraryExercise[]> {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle, set_measurement_type')
      .order('name')
    if (error) return []
    return (data ?? []) as LibraryExercise[]
  } catch {
    return []
  }
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

// ── Component ──────────────────────────────────────────────────────────────
interface WorkoutScreenProps {
  workout: WorkoutState
  setWorkout: (w: WorkoutState | null) => void
}

export default function WorkoutScreen({ workout, setWorkout }: WorkoutScreenProps) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() => normalizeExercises(workout.exercises))
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - workout.startTs) / 1000))
  const [showRecap, setShowRecap] = useState(false)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Usual weights panel (Req 3) ───────────────────────────────────────
  const [usualOpen, setUsualOpen] = useState<number | null>(null)
  const [usualLoading, setUsualLoading] = useState(false)
  const [usualRows, setUsualRows] = useState<UsualWeightRow[]>([])

  // ── Swap-from-library picker (Req 7) ──────────────────────────────────
  const [swapOpen, setSwapOpen] = useState<number | null>(null)   // exercise index being swapped
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapRows, setSwapRows] = useState<LibraryExercise[]>([])
  const [swapSearch, setSwapSearch] = useState('')
  const [swapMuscle, setSwapMuscle] = useState('Tous')

  // ── Per-exercise comment field (Req 12.2, 12.3) ───────────────────────
  const [commentOpen, setCommentOpen] = useState<number | null>(null)

  const chronoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // ── Chrono ─────────────────────────────────────────────────────────────
  useEffect(() => {
    chronoRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - workout.startTs) / 1000))
    }, 1000)
    return () => { if (chronoRef.current) clearInterval(chronoRef.current) }
  }, [workout.startTs])

  // ── Auto-save to localStorage every 5s ─────────────────────────────────
  const persistState = useCallback(() => {
    const state: WorkoutState = { ...workout, exercises }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [workout, exercises])

  useEffect(() => {
    autoSaveRef.current = setInterval(persistState, 5000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [persistState])

  // ── Rest timer management ──────────────────────────────────────────────
  function startRestTimer(exIdx: number, setIdx: number, restSec: number) {
    const key = `${exIdx}-${setIdx}`
    // clear if already running
    if (restRefs.current.has(key)) {
      clearInterval(restRefs.current.get(key)!)
      restRefs.current.delete(key)
    }

    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets[setIdx].restLeft = restSec
      next[exIdx].sets[setIdx].restPaused = false
      return next
    })

    const interval = setInterval(() => {
      setExercises(prev => {
        const next = structuredClone(prev)
        const set = next[exIdx].sets[setIdx]
        if (set.restPaused) return prev
        if (set.restLeft <= 1) {
          set.restLeft = 0
          clearInterval(restRefs.current.get(key)!)
          restRefs.current.delete(key)
          return next
        }
        set.restLeft -= 1
        return next
      })
    }, 1000)

    restRefs.current.set(key, interval)
  }

  function toggleRestPause(exIdx: number, setIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets[setIdx].restPaused = !next[exIdx].sets[setIdx].restPaused
      return next
    })
  }

  function stopRestEarly(exIdx: number, setIdx: number) {
    const key = `${exIdx}-${setIdx}`
    if (restRefs.current.has(key)) {
      clearInterval(restRefs.current.get(key)!)
      restRefs.current.delete(key)
    }
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets[setIdx].restLeft = 0
      return next
    })
  }

  // ── Cleanup intervals on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      restRefs.current.forEach(i => clearInterval(i))
      restRefs.current.clear()
    }
  }, [])

  // ── Set actions ────────────────────────────────────────────────────────
  function updateSet(exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'duration' | 'rpe', value: string) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets[setIdx][field] = value
      return next
    })
  }

  function adjustValue(exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'duration', delta: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      const current = parseFloat(next[exIdx].sets[setIdx][field]) || 0
      const newVal = Math.max(0, current + delta)
      next[exIdx].sets[setIdx][field] = field === 'weight' ? newVal.toString() : Math.round(newVal).toString()
      return next
    })
  }

  function validateSet(exIdx: number, setIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets[setIdx].done = true
      return next
    })
    // start rest timer
    const restSec = exercises[exIdx].restSec || 90
    startRestTimer(exIdx, setIdx, restSec)
  }

  function toggleExerciseComplete(exIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].completed = !next[exIdx].completed
      return next
    })
  }

  function updateExerciseName(exIdx: number, name: string) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].name = name
      return next
    })
  }

  // ── Per-exercise comment (Req 12.2, 12.3) ──────────────────────────────
  // Writes the note into ex.comment; the save payload already includes
  // `comment` when present, so this note round-trips into history.
  function updateExerciseComment(exIdx: number, value: string) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].comment = value
      return next
    })
  }

  // Toggle the collapsible comment field for an exercise.
  function toggleComment(exIdx: number) {
    setCommentOpen(cur => (cur === exIdx ? null : exIdx))
  }

  // ── Usual weights panel toggle (Req 3) ─────────────────────────────────
  // Always re-queries against the exercise's CURRENT name each time it opens,
  // so name changes/swaps surface the new name's history (Req 3.4).
  async function toggleUsualWeights(exIdx: number) {
    if (usualOpen === exIdx) {
      setUsualOpen(null)                 // dismiss (Req 3.6)
      return
    }
    const name = exercises[exIdx].name
    setUsualOpen(exIdx)
    setUsualRows([])
    setUsualLoading(true)
    const rows = await queryUsualWeights(name)
    // Only apply if this exercise is still the open one (avoid stale results)
    setUsualOpen(cur => {
      if (cur === exIdx) {
        setUsualRows(rows)
        setUsualLoading(false)
      }
      return cur
    })
  }

  // ── Swap-from-library picker (Req 7) ───────────────────────────────────
  // Opens a picker listing the exercise library. Selecting a row replaces the
  // current exercise's name/muscle/measurementType in place while keeping its
  // existing sets (weights/reps/duration/done). (Req 7.1–7.4, 7.6)
  async function openSwapPicker(exIdx: number) {
    setSwapOpen(exIdx)
    setSwapSearch('')
    setSwapMuscle('Tous')
    setSwapRows([])
    setSwapLoading(true)
    const rows = await queryLibrary()
    setSwapOpen(cur => {
      if (cur === exIdx) {
        setSwapRows(rows)
        setSwapLoading(false)
      }
      return cur
    })
  }

  function closeSwapPicker() {
    setSwapOpen(null)
  }

  // ── Reorder exercises (Req 8) ──────────────────────────────────────────
  // Moves the exercise at `exIdx` by `dir` (-1 = up, +1 = down), swapping it
  // with the adjacent exercise. structuredClone preserves each exercise's full
  // object (sets, entered values, completed, name, muscle, measurementType,
  // tempo, comment). The save payload maps `exercises` in current order, so the
  // reordered sequence is persisted automatically (Req 8.2, 8.3, 8.4).
  function moveExercise(exIdx: number, dir: -1 | 1) {
    const target = exIdx + dir
    setExercises(prev => {
      if (target < 0 || target >= prev.length) return prev
      const next = structuredClone(prev)
      const tmp = next[exIdx]
      next[exIdx] = next[target]
      next[target] = tmp
      return next
    })
    // Reordering shifts indices; the usual-weights / swap / comment panels are
    // keyed by index, so close them to avoid pointing at the wrong exercise.
    setUsualOpen(null)
    setSwapOpen(null)
    setCommentOpen(null)
  }

  function selectSwap(exIdx: number, lib: LibraryExercise) {
    setExercises(prev => {
      const next = structuredClone(prev)
      // Replace identity in place; preserve the exercise's existing sets (Req 7.3, 7.4)
      next[exIdx].name = lib.name
      next[exIdx].muscle = lib.muscle
      next[exIdx].measurementType = lib.set_measurement_type === 'seconds' ? 'seconds' : 'reps'
      return next
    })
    // If the usual-weights panel is open for this exercise, close it so the next
    // open re-queries against the new name (Req 3.4 tie-in with 7.2).
    setUsualOpen(cur => (cur === exIdx ? null : cur))
    closeSwapPicker()
  }

  // ── End workout ────────────────────────────────────────────────────────
  function handleEndClick() {
    setShowRecap(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const session = {
        user_id: user.id,
        name: `${workout.dayName} — ${workout.progName}`,
        date: new Date().toISOString().split('T')[0],
        duration_sec: elapsed,
        notes: comment || '',
        exercises: exercises.map(ex => ({
          name: ex.name,
          muscle: ex.muscle,
          measurementType: ex.measurementType,
          ...(ex.comment ? { comment: ex.comment } : {}),
          sets: ex.sets.filter(s => s.done).map(s => (
            ex.measurementType === 'seconds'
              ? { weight: s.weight, duration: s.duration, rpe: s.rpe || '' }
              : { weight: s.weight, reps: s.reps, rpe: s.rpe || '' }
          ))
        }))
      }

      const { error } = await supabase.from('sessions').insert(session)
      if (error) throw error

      localStorage.removeItem(STORAGE_KEY)
      showToast('Séance sauvegardée !', 'success')
      setWorkout(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      showToast(`Erreur: ${message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    localStorage.removeItem(STORAGE_KEY)
    setWorkout(null)
  }

  // ── Computed stats ─────────────────────────────────────────────────────
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0)
  const totalVolume = exercises.reduce((acc, ex) => {
    return acc + ex.sets.filter(s => s.done).reduce((sum, s) => {
      return sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)
    }, 0)
  }, 0)

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="wk-screen">
      {/* Header */}
      <div className="wk-header">
        <div style={{ flex: 1 }}>
          <div className="wk-day-name">{workout.dayName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{workout.progName}</div>
        </div>
        <div className="wk-chrono">{formatTime(elapsed)}</div>
        <button
          className="btn-primary"
          style={{ marginLeft: 12, padding: '8px 16px', fontSize: 13 }}
          onClick={handleEndClick}
        >
          Fin
        </button>
      </div>

      {/* Body */}
      <div className="wk-body" ref={bodyRef}>
        {exercises.map((ex, exIdx) => (
          <div
            key={exIdx}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              padding: 16,
              marginBottom: 12,
              opacity: ex.completed ? 0.5 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {/* Exercise header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <button
                onClick={() => toggleExerciseComplete(exIdx)}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: ex.completed ? 'var(--neon)' : 'var(--bg-raised)',
                  border: `1px solid ${ex.completed ? 'var(--neon)' : 'var(--line)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ex.completed ? '#0a0c0f' : 'var(--ink-faint)',
                  fontSize: 14, cursor: 'pointer', flexShrink: 0
                }}
              >
                {ex.completed ? '✓' : ''}
              </button>
              <input
                type="text"
                value={ex.name}
                onChange={e => updateExerciseName(exIdx, e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  fontWeight: 700, fontSize: 15, color: 'var(--ink)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  padding: '4px 0'
                }}
              />
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                color: 'var(--neon)', background: 'var(--neon-soft)',
                padding: '3px 8px', borderRadius: 12, letterSpacing: '0.04em'
              }}>
                {ex.muscle}
              </span>
              {/* Usual weights toggle (Req 3.1) */}
              <button
                onClick={() => toggleUsualWeights(exIdx)}
                title="Charges habituelles"
                aria-label="Charges habituelles"
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: usualOpen === exIdx ? 'var(--neon-soft)' : 'var(--bg-raised)',
                  border: `1px solid ${usualOpen === exIdx ? 'var(--neon)' : 'var(--line)'}`,
                  color: usualOpen === exIdx ? 'var(--neon)' : 'var(--ink-dim)',
                  fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                🕑
              </button>
              {/* Swap / replace from library (Req 7.1) */}
              <button
                onClick={() => openSwapPicker(exIdx)}
                title="Remplacer l'exercice"
                aria-label="Remplacer l'exercice"
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: swapOpen === exIdx ? 'var(--neon-soft)' : 'var(--bg-raised)',
                  border: `1px solid ${swapOpen === exIdx ? 'var(--neon)' : 'var(--line)'}`,
                  color: swapOpen === exIdx ? 'var(--neon)' : 'var(--ink-dim)',
                  fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                🔄
              </button>
              {/* Per-exercise comment toggle (Req 12.2) */}
              <button
                onClick={() => toggleComment(exIdx)}
                title="Note sur l'exercice"
                aria-label="Note sur l'exercice"
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: commentOpen === exIdx || (ex.comment && ex.comment.trim() !== '') ? 'var(--neon-soft)' : 'var(--bg-raised)',
                  border: `1px solid ${commentOpen === exIdx ? 'var(--neon)' : 'var(--line)'}`,
                  color: commentOpen === exIdx || (ex.comment && ex.comment.trim() !== '') ? 'var(--neon)' : 'var(--ink-dim)',
                  fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                💬
              </button>
              {/* Reorder up (Req 8.1) — disabled on the first exercise */}
              <button
                onClick={() => moveExercise(exIdx, -1)}
                disabled={exIdx === 0}
                title="Monter l'exercice"
                aria-label="Monter l'exercice"
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-dim)',
                  fontSize: 14, cursor: exIdx === 0 ? 'not-allowed' : 'pointer',
                  opacity: exIdx === 0 ? 0.35 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ▲
              </button>
              {/* Reorder down (Req 8.1) — disabled on the last exercise */}
              <button
                onClick={() => moveExercise(exIdx, 1)}
                disabled={exIdx === exercises.length - 1}
                title="Descendre l'exercice"
                aria-label="Descendre l'exercice"
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-dim)',
                  fontSize: 14, cursor: exIdx === exercises.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: exIdx === exercises.length - 1 ? 0.35 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ▼
              </button>
            </div>

            {/* Tempo chip (Req 13.4) — shown only when the exercise has a
                non-empty tempo; omitted otherwise (Req 13.5) */}
            {ex.tempo && ex.tempo.trim() !== '' && (
              <div style={{ marginBottom: 12 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700,
                  color: 'var(--ink-dim)', background: 'var(--bg-raised)',
                  border: '1px solid var(--line)',
                  padding: '3px 8px', borderRadius: 12,
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  Tempo: {ex.tempo}
                </span>
              </div>
            )}

            {/* Per-exercise comment field (Req 12.2, 12.3) — collapsible;
                bound to ex.comment. Included in the save payload when present. */}
            {commentOpen === exIdx && (
              <div style={{
                background: 'var(--bg-raised)', border: '1px solid var(--line)',
                borderRadius: 8, padding: 12, marginBottom: 12
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--ink)',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    Note
                  </span>
                  <button
                    onClick={() => setCommentOpen(null)}
                    aria-label="Fermer"
                    title="Fermer"
                    style={{
                      marginLeft: 'auto', width: 22, height: 22, borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--line)',
                      color: 'var(--ink-faint)', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={ex.comment ?? ''}
                  onChange={e => updateExerciseComment(exIdx, e.target.value)}
                  placeholder="Note sur cet exercice…"
                  style={{
                    width: '100%', minHeight: 56, resize: 'vertical',
                    padding: '8px 10px', borderRadius: 6,
                    background: 'var(--bg)', border: '1px solid var(--line)',
                    color: 'var(--ink)', fontSize: 13,
                    fontFamily: 'inherit', boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Usual weights panel (Req 3) */}
            {usualOpen === exIdx && (
              <div style={{
                background: 'var(--bg-raised)', border: '1px solid var(--line)',
                borderRadius: 8, padding: 12, marginBottom: 12
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--ink)',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    Charges habituelles
                  </span>
                  <button
                    onClick={() => setUsualOpen(null)}
                    aria-label="Fermer"
                    title="Fermer"
                    style={{
                      marginLeft: 'auto', width: 22, height: 22, borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--line)',
                      color: 'var(--ink-faint)', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
                {usualLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Chargement…</div>
                ) : usualRows.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    Aucun historique pour cet exercice.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {usualRows.map((row, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12, color: 'var(--ink-dim)',
                        padding: '3px 0',
                        borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none'
                      }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700, color: 'var(--ink)'
                        }}>
                          {row.weight || '0'} kg
                        </span>
                        <span style={{ color: 'var(--ink-faint)' }}>×</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {row.duration ? `${row.duration}s` : `${row.reps ?? '0'} reps`}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)' }}>
                          {row.date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sets */}
            {ex.sets.map((set, setIdx) => (
              <div key={setIdx}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderTop: setIdx > 0 ? '1px solid var(--line-soft)' : 'none'
                }}>
                  {/* Set number */}
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: set.done ? 'var(--neon-soft)' : 'var(--bg-raised)',
                    border: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: set.done ? 'var(--neon)' : 'var(--ink-faint)',
                    flexShrink: 0
                  }}>
                    {setIdx + 1}
                  </div>

                  {/* Weight */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => adjustValue(exIdx, setIdx, 'weight', -2.5)}
                      style={{
                        width: 26, height: 26, borderRadius: 6,
                        background: 'var(--bg-raised)', border: '1px solid var(--line)',
                        color: 'var(--ink-dim)', fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >−</button>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={set.weight}
                      onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                      placeholder="0"
                      style={{
                        width: 52, textAlign: 'center', padding: '5px 4px',
                        fontSize: 14, fontWeight: 600, borderRadius: 6,
                        background: 'var(--bg-raised)', border: '1px solid var(--line)',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                    />
                    <button
                      onClick={() => adjustValue(exIdx, setIdx, 'weight', 2.5)}
                      style={{
                        width: 26, height: 26, borderRadius: 6,
                        background: 'var(--bg-raised)', border: '1px solid var(--line)',
                        color: 'var(--ink-dim)', fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >+</button>
                    <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 2 }}>kg</span>
                  </div>

                  {/* Middle value column: reps OR seconds (duration) depending
                      on the exercise's measurementType (Req 11.3, 11.4) */}
                  {ex.measurementType === 'seconds' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => adjustValue(exIdx, setIdx, 'duration', -5)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          color: 'var(--ink-dim)', fontSize: 14, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >−</button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.duration}
                        onChange={e => updateSet(exIdx, setIdx, 'duration', e.target.value)}
                        placeholder="0"
                        style={{
                          width: 42, textAlign: 'center', padding: '5px 4px',
                          fontSize: 14, fontWeight: 600, borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          fontFamily: "'JetBrains Mono', monospace"
                        }}
                      />
                      <button
                        onClick={() => adjustValue(exIdx, setIdx, 'duration', 5)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          color: 'var(--ink-dim)', fontSize: 14, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >+</button>
                      <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 2 }}>s</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => adjustValue(exIdx, setIdx, 'reps', -1)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          color: 'var(--ink-dim)', fontSize: 14, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >−</button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps}
                        onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                        placeholder="0"
                        style={{
                          width: 42, textAlign: 'center', padding: '5px 4px',
                          fontSize: 14, fontWeight: 600, borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          fontFamily: "'JetBrains Mono', monospace"
                        }}
                      />
                      <button
                        onClick={() => adjustValue(exIdx, setIdx, 'reps', 1)}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          color: 'var(--ink-dim)', fontSize: 14, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >+</button>
                      <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 2 }}>reps</span>
                    </div>
                  )}

                  {/* RPE (optional small input) */}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={set.rpe}
                    onChange={e => updateSet(exIdx, setIdx, 'rpe', e.target.value)}
                    placeholder="RPE"
                    style={{
                      width: 38, textAlign: 'center', padding: '5px 2px',
                      fontSize: 11, borderRadius: 6,
                      background: 'var(--bg-raised)', border: '1px solid var(--line)',
                      color: 'var(--ink-dim)'
                    }}
                  />

                  {/* Validate button */}
                  {!set.done && (
                    <button
                      onClick={() => validateSet(exIdx, setIdx)}
                      style={{
                        padding: '5px 10px', borderRadius: 6,
                        background: 'var(--neon)', color: '#0a0c0f',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✓
                    </button>
                  )}
                  {set.done && set.restLeft === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓</span>
                  )}
                </div>

                {/* Rest timer */}
                {set.done && set.restLeft > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginTop: 4, marginBottom: 4,
                    background: 'var(--neon-soft)', borderRadius: 8
                  }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 18, fontWeight: 700, color: 'var(--neon)'
                    }}>
                      {formatTime(set.restLeft)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-dim)' }}>repos</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => toggleRestPause(exIdx, setIdx)}
                        style={{
                          padding: '4px 10px', borderRadius: 6,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)',
                          fontSize: 11, color: 'var(--ink)', cursor: 'pointer'
                        }}
                      >
                        {set.restPaused ? '▶' : '⏸'}
                      </button>
                      <button
                        onClick={() => stopRestEarly(exIdx, setIdx)}
                        style={{
                          padding: '4px 10px', borderRadius: 6,
                          background: 'rgba(240,68,68,0.1)', border: '1px solid rgba(240,68,68,0.2)',
                          fontSize: 11, color: 'var(--danger)', cursor: 'pointer'
                        }}
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Swap-from-library picker modal (Req 7.2) */}
      {swapOpen !== null && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}
            onClick={closeSwapPicker}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: 20,
            width: 'min(420px, 92vw)',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, flex: 1 }}>
                Remplacer l'exercice
              </h3>
              <button
                onClick={closeSwapPicker}
                aria-label="Fermer"
                title="Fermer"
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: 'transparent', border: '1px solid var(--line)',
                  color: 'var(--ink-faint)', fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Rechercher…"
              value={swapSearch}
              onChange={e => setSwapSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--bg)',
                color: 'var(--ink)', fontSize: 14, marginBottom: 10
              }}
            />

            {/* Muscle filter chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {SWAP_MUSCLES.map(m => (
                <button
                  key={m}
                  onClick={() => setSwapMuscle(m)}
                  style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                    background: swapMuscle === m ? 'var(--neon)' : 'var(--bg)',
                    color: swapMuscle === m ? '#0a0c0f' : 'var(--ink-dim)',
                    border: `1px solid ${swapMuscle === m ? 'var(--neon)' : 'var(--line)'}`,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Results */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {swapLoading ? (
                <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: 20, textAlign: 'center' }}>
                  Chargement…
                </div>
              ) : (() => {
                const results = swapRows.filter(r =>
                  (swapMuscle === 'Tous' || r.muscle === swapMuscle) &&
                  r.name.toLowerCase().includes(swapSearch.toLowerCase())
                )
                if (results.length === 0) {
                  return (
                    <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: 20, textAlign: 'center' }}>
                      Aucun exercice trouvé
                    </div>
                  )
                }
                return results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => selectSwap(swapOpen, r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                      background: 'var(--bg)', border: '1px solid var(--line)',
                      cursor: 'pointer', width: '100%'
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                      {r.name}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      color: 'var(--neon)', background: 'var(--neon-soft)',
                      padding: '3px 8px', borderRadius: 12, letterSpacing: '0.04em'
                    }}>
                      {r.muscle}
                    </span>
                  </button>
                ))
              })()}
            </div>
          </div>
        </>
      )}

      {/* Recap modal */}
      {showRecap && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <span>Récap séance</span>
              <button className="modal-close" onClick={() => setShowRecap(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: 'var(--neon)' }}>
                    {formatTime(elapsed)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Durée</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: 'var(--neon)' }}>
                    {totalSets}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Séries</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: 'var(--neon)' }}>
                    {Math.round(totalVolume)} kg
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Volume</div>
                </div>
              </div>

              <div className="field">
                <label>Commentaire (optionnel)</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Comment s'est passée la séance ?"
                  style={{ minHeight: 60 }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={handleDiscard}>Abandonner</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
