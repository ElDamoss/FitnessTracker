import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────
export interface WorkoutSet {
  weight: string
  reps: string          // used when measurementType === 'reps'
  duration: string      // seconds value, used when measurementType === 'seconds'
  rpe: string
  done: boolean
  restLeft: number      // secondes restantes affichées (dérivé de restEndTs si actif)
  restPaused: boolean
  restEndTs?: number     // timestamp (ms) de fin du repos ; source de vérité pour
                         // recalculer restLeft même après mise en arrière-plan (Point 2 V8.2)
  restTotal?: number     // durée totale du repos (s), pour l'anneau de progression (V8.3)
  // Côté DROIT pour les exercices unilatéraux (V8.3). weight/reps/duration
  // ci-dessus servent alors au côté GAUCHE. Ignorés si l'exo n'est pas unilatéral.
  weightR?: string
  repsR?: string
  durationR?: string
}

export interface WorkoutExercise {
  name: string
  muscle: string
  restSec: number
  completed: boolean
  measurementType: 'reps' | 'seconds'   // defaulted from exercise.set_measurement_type
  tempo?: string                        // free text from program exercise
  rpeEnabled?: boolean                  // drives conditional RPE input display (§4)
  comment?: string                      // per-exercise note
  unilateral?: boolean                  // saisie gauche/droite séparée (V8.3)
  sets: WorkoutSet[]
}

export interface UsualWeightRow {
  date: string
  weight: string
  reps?: string
  duration?: string
  // Côté droit (exercices unilatéraux, V8.3) — présents seulement si l'historique
  // a été enregistré en unilatéral.
  weightR?: string
  repsR?: string
  durationR?: string
}

// A row from the exercise library (`exercises` table) used by the swap picker (Req 7)
export interface LibraryExercise {
  id: string
  name: string
  muscle: string
  set_measurement_type?: 'reps' | 'seconds'
}

// Muscle-chip filter values, mirroring the pattern used in Exercises.tsx
const SWAP_MUSCLES = ['Tous', 'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras', 'Abdominaux', 'Obliques', 'Lombaires', 'Quadriceps', 'Ischio-jambiers', 'Mollets', 'Adducteurs', 'Abducteurs', 'Grand fessier', 'Moyen fessier', 'Petit fessier', 'Cardio', 'Full body']

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
    unilateral: ex.unilateral ?? false,
    sets: (ex.sets ?? []).map(set => ({
      weight: set.weight ?? '',
      reps: set.reps ?? '',
      duration: set.duration ?? '',
      rpe: set.rpe ?? '',
      done: set.done ?? false,
      restLeft: set.restLeft ?? 0,
      restPaused: set.restPaused ?? false,
      restEndTs: set.restEndTs,
      restTotal: set.restTotal,
      weightR: set.weightR ?? '',
      repsR: set.repsR ?? '',
      durationR: set.durationR ?? '',
    })),
  }))
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Normalise un nom d'exercice pour comparer l'historique de façon tolérante :
// minuscules, sans accents, espaces multiples réduits, trim. Ainsi "Presse
// Pectoraux " et "presse pectoraux" correspondent (Point 3 V8.2).
function normalizeName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // retire les accents
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Query the user's recent session history for sets recorded under `name`
// (the exercise's CURRENT name). Returns the sets from ONLY the most recent
// session that contains this exercise — not every past session. Sessions are
// scanned newest-first; the first one containing a matching exercise wins and
// its sets are returned. Returns [] on any error or when there is no history. (Req 3)
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
    // Iterate from most recent to oldest; return the sets from the FIRST
    // session that contains an exercise with a matching name. Comparaison
    // normalisée (casse/accents/espaces) pour éviter les faux "aucun
    // historique" sur certaines machines (Point 3 V8.2).
    const target = normalizeName(name)
    for (const s of (data ?? []) as { date: string; exercises?: { name?: string; sets?: { weight?: string; reps?: string; duration?: string; weightR?: string; repsR?: string; durationR?: string }[] }[] }[]) {
      const match = (s.exercises ?? []).find(ex => normalizeName(ex.name ?? '') === target)   // keyed on current exercise NAME (Req 3.2)
      if (match) {
        return (match.sets ?? []).map(st => ({
          date: s.date,
          weight: st.weight ?? '',
          reps: st.reps,
          duration: st.duration,
          weightR: st.weightR,
          repsR: st.repsR,
          durationR: st.durationR,
        }))
      }
    }
    return []                                       // [] → panel shows "no history" (Req 3.5)
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
  // Réduit la séance : persiste l'état courant et masque l'écran sans le
  // détruire, pour naviguer ailleurs puis reprendre (Point 1 V8.2).
  onMinimize?: (w: WorkoutState) => void
}

export default function WorkoutScreen({ workout, setWorkout, onMinimize }: WorkoutScreenProps) {
  // Au (re)montage — après avoir réduit la séance puis navigué — on reprend
  // en priorité l'état sauvegardé dans localStorage (le plus récent : poids
  // saisis, séries validées, repos en cours), à condition qu'il corresponde
  // à LA MÊME séance (progId+dayId+startTs). Sinon on part du prop d'origine.
  // Corrige la perte des poids/repos au retour depuis l'accueil.
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as WorkoutState
        const sameSession =
          parsed &&
          parsed.progId === workout.progId &&
          parsed.dayId === workout.dayId &&
          parsed.startTs === workout.startTs &&
          Array.isArray(parsed.exercises)
        if (sameSession) return normalizeExercises(parsed.exercises)
      }
    } catch { /* ignore, fallback au prop */ }
    return normalizeExercises(workout.exercises)
  })
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - workout.startTs) / 1000))
  const [showRecap, setShowRecap] = useState(false)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Overlay de repos réduit en pastille flottante (option A) : le décompte
  // continue (logique timestamp), mais l'écran n'est plus bloqué.
  const [restMinimized, setRestMinimized] = useState(false)

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

  const chronoRef = useRef<ReturnType<typeof setInterval> | null>(null)
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

  // ── Rest timer management (timestamp-based, Point 2 V8.2) ──────────────
  // Le repos n'est plus décrémenté seconde par seconde (fragile en
  // arrière-plan) : on stocke restEndTs (fin visée) et on recalcule restLeft
  // = ceil((restEndTs - now)/1000) à chaque tick ET au retour de visibilité.
  // Une pause fige restEndTs en conservant restLeft comme "durée restante".
  function startRestTimer(exIdx: number, setIdx: number, restSec: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      const set = next[exIdx].sets[setIdx]
      set.restLeft = restSec
      set.restPaused = false
      set.restEndTs = Date.now() + restSec * 1000
      set.restTotal = restSec
      return next
    })
    // Nouveau repos → on ré-affiche l'overlay plein écran (option A).
    setRestMinimized(false)
  }

  function toggleRestPause(exIdx: number, setIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      const set = next[exIdx].sets[setIdx]
      if (set.restPaused) {
        // Reprise : recalcule une nouvelle fin à partir du restant figé.
        set.restPaused = false
        set.restEndTs = Date.now() + (set.restLeft || 0) * 1000
      } else {
        // Pause : fige le restant courant et efface la fin visée.
        set.restPaused = true
        set.restLeft = set.restEndTs
          ? Math.max(0, Math.ceil((set.restEndTs - Date.now()) / 1000))
          : set.restLeft
        set.restEndTs = undefined
      }
      return next
    })
  }

  function stopRestEarly(exIdx: number, setIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      const set = next[exIdx].sets[setIdx]
      set.restLeft = 0
      set.restPaused = false
      set.restEndTs = undefined
      return next
    })
  }

  // Recalcule restLeft de tous les sets ayant un restEndTs actif. Appelé à
  // chaque tick et au retour au premier plan. Ne touche pas aux repos en pause
  // (restEndTs undefined) ni terminés.
  const syncRestTimers = useCallback(() => {
    setExercises(prev => {
      let changed = false
      const now = Date.now()
      const next = prev.map(ex => ({
        ...ex,
        sets: ex.sets.map(set => {
          if (set.restPaused || !set.restEndTs) return set
          const remaining = Math.max(0, Math.ceil((set.restEndTs - now) / 1000))
          if (remaining === set.restLeft && !(remaining === 0 && set.restEndTs)) return set
          changed = true
          return {
            ...set,
            restLeft: remaining,
            restEndTs: remaining === 0 ? undefined : set.restEndTs,
          }
        }),
      }))
      return changed ? next : prev
    })
  }, [])

  // Tick global (1s) : source unique de décompte, indépendante du nombre de
  // repos actifs. + resynchro immédiate quand l'app revient au premier plan
  // (visibilitychange) pour rattraper le throttling des timers en arrière-plan.
  useEffect(() => {
    const interval = setInterval(syncRestTimers, 1000)
    const onVisible = () => { if (!document.hidden) syncRestTimers() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [syncRestTimers])

  // ── Set actions ────────────────────────────────────────────────────────
  type SetField = 'weight' | 'reps' | 'duration' | 'rpe' | 'weightR' | 'repsR' | 'durationR'

  function updateSet(exIdx: number, setIdx: number, field: SetField, value: string) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets[setIdx][field] = value
      return next
    })
  }

  // Bascule l'exercice en unilatéral (saisie G/D) pour la séance courante (V8.3).
  function toggleUnilateral(exIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].unilateral = !next[exIdx].unilateral
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

  // ── Add / remove sets during the workout ──────────────────────────────
  // Appends a fresh empty set to this exercise, matching the WorkoutSet shape
  // used everywhere else. New sets flow through handleSave normally (only
  // `done` sets are saved — unchanged behavior).
  function addSet(exIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].sets.push({
        weight: '', reps: '', duration: '', rpe: '',
        done: false, restLeft: 0, restPaused: false,
      })
      return next
    })
  }

  // Removes a specific set. Guard: never remove the last remaining set (keep at
  // least 1). Also clears any running rest timer for this exercise so no
  // interval keeps writing to a set index that shifted or no longer exists.
  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => {
      if (prev[exIdx].sets.length <= 1) return prev
      const next = structuredClone(prev)
      next[exIdx].sets.splice(setIdx, 1)
      // Reset rest state on remaining sets of this exercise (indices shift).
      next[exIdx].sets.forEach(s => { s.restLeft = 0; s.restPaused = false; s.restEndTs = undefined })
      return next
    })
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

  // ── Day-of reps/seconds toggle (Req 7.4) ───────────────────────────────
  // Flips this exercise's measurementType between 'reps' and 'seconds' for the
  // CURRENT session only (does not touch the saved program). The middle set
  // input already switches on measurementType, and handleSave already routes
  // the entered value to `reps` or `duration` based on it — so nothing else
  // needs to change here.
  function toggleMeasurementType(exIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev)
      next[exIdx].measurementType = next[exIdx].measurementType === 'seconds' ? 'reps' : 'seconds'
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

  // Réduit la séance : sauvegarde immédiate de l'état complet puis remonte au
  // parent qui masque l'écran tout en gardant workoutState en mémoire (Point 1).
  function handleMinimize() {
    const state: WorkoutState = { ...workout, exercises }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (onMinimize) onMinimize(state)
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
          ...(ex.unilateral ? { unilateral: true } : {}),
          sets: ex.sets.filter(s => s.done).map(s => {
            // Champs de base (côté gauche si unilatéral, sinon valeur unique)
            const base = ex.measurementType === 'seconds'
              ? { weight: s.weight, duration: s.duration, rpe: s.rpe || '' }
              : { weight: s.weight, reps: s.reps, rpe: s.rpe || '' }
            if (!ex.unilateral) return base
            // Ajoute le côté droit pour l'historique/récap (V8.3)
            const right = ex.measurementType === 'seconds'
              ? { weightR: s.weightR || '', durationR: s.durationR || '' }
              : { weightR: s.weightR || '', repsR: s.repsR || '' }
            return { ...base, ...right }
          })
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

  // ── Repos actif (pour l'overlay anneau V8.3) ──────────────────────────
  // On ne gère qu'un repos à la fois : on prend le premier set en cours de
  // repos (restLeft > 0). Renvoie ses index + total pour l'anneau.
  let activeRest: { exIdx: number; setIdx: number; exName: string; left: number; total: number; paused: boolean } | null = null
  for (let ei = 0; ei < exercises.length && !activeRest; ei++) {
    const ex = exercises[ei]
    for (let si = 0; si < ex.sets.length; si++) {
      const s = ex.sets[si]
      if (s.restLeft > 0) {
        activeRest = { exIdx: ei, setIdx: si, exName: ex.name, left: s.restLeft, total: s.restTotal || ex.restSec || s.restLeft, paused: s.restPaused }
        break
      }
    }
  }

  // ── Computed stats ─────────────────────────────────────────────────────
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0)
  // Progression header/barre (V8.3) : séries validées vs total de toutes les séries
  const doneSetsCount = totalSets
  const allSetsCount = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
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
        {/* Réduire : garde la séance en cours et revient au menu (Point 1) */}
        <button
          onClick={handleMinimize}
          title="Réduire (reprendre plus tard)"
          aria-label="Réduire la séance"
          style={{
            width: 34, height: 34, borderRadius: 8, marginRight: 10, flexShrink: 0,
            background: 'var(--bg-raised)', border: '1px solid var(--line)',
            color: 'var(--ink-dim)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wk-day-name">{workout.dayName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{workout.progName}</div>
        </div>
        {/* Bloc Durée avec label (aligné maquette V8.3) */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Durée</div>
          <div className="wk-chrono mono">{formatTime(elapsed)}</div>
        </div>
        {/* Compteur de progression séries validées / total (aligné maquette V8.3) */}
        <div style={{ fontSize: 11, color: 'var(--neon)', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {doneSetsCount}/{allSetsCount}
        </div>
        <button
          className="btn-primary btn-sm"
          style={{ marginLeft: 4 }}
          onClick={handleEndClick}
        >
          Fin ▸
        </button>
      </div>

      {/* Barre de progression globale (aligné maquette V8.3) */}
      <div style={{ height: 3, background: 'var(--line)', flexShrink: 0 }}>
        <div style={{ height: '100%', background: 'var(--neon)', width: `${allSetsCount ? (doneSetsCount / allSetsCount) * 100 : 0}%`, transition: 'width .3s ease' }} />
      </div>

      {/* Body */}
      <div className="wk-body" ref={bodyRef}>
        {exercises.map((ex, exIdx) => (
          <div
            key={exIdx}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 14,
              opacity: ex.completed ? 0.5 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {/* Bandeau d'en-tête (maquette V8.3) : nom + case complétée + toggles +
                actions icônes + flèches d'ordre, sur fond var(--bg-raised). */}
            <div style={{
              background: 'var(--bg-raised)', padding: '10px 10px 10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10
            }}>
              <button
                onClick={() => toggleExerciseComplete(exIdx)}
                style={{
                  width: 24, height: 24, borderRadius: 6, marginTop: 2,
                  background: ex.completed ? 'var(--neon)' : 'var(--bg-panel)',
                  border: `1px solid ${ex.completed ? 'var(--neon)' : 'var(--line)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ex.completed ? '#0a0c0f' : 'var(--ink-faint)',
                  fontSize: 14, cursor: 'pointer', flexShrink: 0
                }}
              >
                {ex.completed ? '✓' : ''}
              </button>
              {/* Name (full width, allowed to wrap — never truncated) + subtitle */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={ex.name}
                  onChange={e => updateExerciseName(exIdx, e.target.value)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    fontWeight: 700, fontSize: 15, color: 'var(--ink)',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    padding: '2px 0'
                  }}
                />
                <div style={{
                  fontSize: 11, color: 'var(--neon)', marginTop: 1, fontWeight: 600
                }}>
                  {ex.muscle}
                  {ex.sets.length > 0 && (
                    <> · {ex.sets.length} série{ex.sets.length > 1 ? 's' : ''}
                      {ex.measurementType === 'seconds' ? ' · temps (s)' : ' · reps'}</>
                  )}
                </div>

                {/* Toggle Unilatéral — switch glissant (maquette V8.3). Garde
                    l'appel toggleUnilateral, saisie G/D séparée. */}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{
                    position: 'relative', width: 32, height: 18, borderRadius: 9,
                    background: ex.unilateral ? 'var(--neon)' : 'var(--line)',
                    transition: 'background .2s', flexShrink: 0
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: ex.unilateral ? 16 : 2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: ex.unilateral ? '#fff' : 'var(--ink-faint)',
                      transition: 'left .2s'
                    }} />
                    <input
                      type="checkbox"
                      checked={!!ex.unilateral}
                      onChange={() => toggleUnilateral(exIdx)}
                      aria-label="Unilatéral"
                      style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer', margin: 0 }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: ex.unilateral ? 'var(--neon)' : 'var(--ink-faint)', fontWeight: 600 }}>
                    Unilatéral
                  </span>
                </label>

                {/* Compact actions row + day-of measurement toggle (Req 5, 7.4) */}
                <div style={{
                  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
                  marginTop: 8
                }}>
              {/* Reps / Temps toggle — flips this exercise's measurementType for
                  the current session only (Req 7.4). Same pill visual as maquette ExCard. */}
              <div style={{
                display: 'flex', borderRadius: 7, overflow: 'hidden',
                border: '1px solid var(--line)', flexShrink: 0
              }}>
                {(['reps', 'seconds'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { if (ex.measurementType !== m) toggleMeasurementType(exIdx) }}
                    title={m === 'reps' ? 'Répétitions' : 'Temps (secondes)'}
                    style={{
                      padding: '4px 10px', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all .15s', border: 'none',
                      background: ex.measurementType === m ? 'var(--neon)' : 'transparent',
                      color: ex.measurementType === m ? '#0a0c0f' : 'var(--ink-faint)'
                    }}
                  >
                    {m === 'reps' ? 'Reps' : 'Temps'}
                  </button>
                ))}
              </div>

              <span style={{ flex: 1 }} />

              {/* Usual weights toggle (Req 3.1) */}
              <button
                onClick={() => toggleUsualWeights(exIdx)}
                title="Dernière séance"
                aria-label="Dernière séance"
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: usualOpen === exIdx ? 'var(--neon-soft)' : 'var(--bg-raised)',
                  border: `1px solid ${usualOpen === exIdx ? 'var(--neon)' : 'var(--line)'}`,
                  color: usualOpen === exIdx ? 'var(--neon)' : 'var(--ink-dim)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
                </svg>
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
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
                </svg>
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
                  cursor: exIdx === 0 ? 'not-allowed' : 'pointer',
                  opacity: exIdx === 0 ? 0.35 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
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
                  cursor: exIdx === exercises.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: exIdx === exercises.length - 1 ? 0.35 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
                </div>{/* fin actions row */}
              </div>{/* fin colonne nom */}
            </div>{/* fin bandeau d'en-tête */}

            {/* Contenu de la carte (padding latéral 14px) */}
            <div style={{ padding: '4px 14px 0' }}>
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

            {/* Usual weights panel (Req 3) — cartes horizontales S1/S2/S3 (maquette V8.3) */}
            {usualOpen === exIdx && (
              <div style={{
                background: 'rgba(var(--neon-rgb),0.04)', border: '1px solid var(--line)',
                borderRadius: 8, padding: 12, marginBottom: 12
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--ink)',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    Dernière séance
                  </span>
                  {!usualLoading && usualRows.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                      · {usualRows[0].date}
                    </span>
                  )}
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    {usualRows.map((row, i) => {
                      const isUni = (row.weightR != null && row.weightR !== '') || (row.repsR != null && row.repsR !== '') || (row.durationR != null && row.durationR !== '')
                      const valTxt = (reps?: string, dur?: string) => dur ? `${dur}s` : `${reps ?? '0'} reps`
                      return (
                        <div key={i} style={{
                          flex: 1, background: 'var(--bg-panel)', border: '1px solid var(--line)',
                          borderRadius: 8, padding: '8px 10px', textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 9, color: 'var(--ink-faint)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            S{i + 1}
                          </div>
                          {isUni ? (
                            <>
                              <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>G</div>
                              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink-dim)', lineHeight: 1 }}>
                                {row.weight || '0'}<span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>kg</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{valTxt(row.reps, row.duration)}</div>
                              <div style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>D</div>
                              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink-dim)', lineHeight: 1 }}>
                                {row.weightR || '0'}<span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>kg</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{valTxt(row.repsR, row.durationR)}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink-dim)', lineHeight: 1 }}>
                                {row.weight || '0'}<span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>kg</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>{valTxt(row.reps, row.duration)}</div>
                            </>
                          )}
                        </div>
                      )
                    })}
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
                  {/* Set number — badge rond (maquette V8.3) */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: set.done ? 'var(--neon)' : 'var(--bg-raised)',
                    border: `1px solid ${set.done ? 'var(--neon)' : 'var(--line)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: set.done ? '#fff' : 'var(--ink-faint)',
                    transition: 'all .15s'
                  }}>
                    {set.done ? '✓' : setIdx + 1}
                  </div>

                  {/* Unilatéral (V8.3) : deux blocs compacts Gauche / Droite,
                      chacun avec kg + reps/sec. weight/reps = gauche, weightR/repsR = droite. */}
                  {ex.unilateral && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {([
                        { side: 'G', wField: 'weight' as const, vField: ex.measurementType === 'seconds' ? 'duration' as const : 'reps' as const, wVal: set.weight, vVal: ex.measurementType === 'seconds' ? set.duration : set.reps },
                        { side: 'D', wField: 'weightR' as const, vField: ex.measurementType === 'seconds' ? 'durationR' as const : 'repsR' as const, wVal: set.weightR ?? '', vVal: ex.measurementType === 'seconds' ? (set.durationR ?? '') : (set.repsR ?? '') },
                      ]).map(col => (
                        <div key={col.side} style={{ flex: 1, background: 'rgba(var(--neon-rgb),0.06)', borderRadius: 10, padding: '6px 8px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--neon)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                            {col.side}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              <input
                                type="number" inputMode="decimal" value={col.wVal}
                                onChange={e => updateSet(exIdx, setIdx, col.wField, e.target.value)}
                                placeholder="0"
                                style={{ width: 46, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, padding: '6px 2px', borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
                              />
                              <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kg</span>
                            </div>
                            <span style={{ color: 'var(--line)', fontSize: 14 }}>×</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              <input
                                type="number" inputMode="numeric" value={col.vVal}
                                onChange={e => updateSet(exIdx, setIdx, col.vField, e.target.value)}
                                placeholder="0"
                                style={{ width: 46, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, padding: '6px 2px', borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
                              />
                              <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ex.measurementType === 'seconds' ? 'sec' : 'reps'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Saisie standard (maquette V8.3) : kg × reps/sec, sans steppers */}
                  {!ex.unilateral && (
                  <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={set.weight}
                      onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                      placeholder="0"
                      style={{
                        width: 54, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700, fontSize: 15, padding: '6px 2px', borderRadius: 8,
                        background: 'var(--bg-raised)', border: '1px solid var(--line)'
                      }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kg</span>
                  </div>

                  <span style={{ color: 'var(--line)', fontSize: 16 }}>×</span>

                  {/* Middle value column: reps OR seconds (duration) depending
                      on the exercise's measurementType (Req 11.3, 11.4) */}
                  {ex.measurementType === 'seconds' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.duration}
                        onChange={e => updateSet(exIdx, setIdx, 'duration', e.target.value)}
                        placeholder="0"
                        style={{
                          width: 54, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, fontSize: 15, padding: '6px 2px', borderRadius: 8,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)'
                        }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>sec</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.reps}
                        onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                        placeholder="0"
                        style={{
                          width: 54, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700, fontSize: 15, padding: '6px 2px', borderRadius: 8,
                          background: 'var(--bg-raised)', border: '1px solid var(--line)'
                        }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>reps</span>
                    </div>
                  )}
                  </>
                  )}

                  {/* RPE input — only rendered when the exercise has RPE enabled
                      (Req 4.2/4.3). When rpeEnabled is false/undefined it is not
                      rendered at all. The `rpe` value is still saved as-is in the
                      payload regardless; only the input visibility changes. */}
                  {ex.rpeEnabled === true && (
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
                  )}

                  {/* Validate button — libellé "OK" / "✓" (maquette V8.3) */}
                  <button
                    onClick={() => { if (!set.done) validateSet(exIdx, setIdx) }}
                    disabled={set.done}
                    style={{
                      marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, flexShrink: 0,
                      background: set.done ? 'var(--neon)' : 'var(--bg-raised)',
                      border: `1px solid ${set.done ? 'var(--neon)' : 'var(--line)'}`,
                      color: set.done ? 'var(--bg)' : 'var(--ink-dim)',
                      fontSize: 12, fontWeight: 700, transition: 'all .15s',
                      cursor: set.done ? 'default' : 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    {set.done ? '✓' : 'OK'}
                  </button>

                  {/* Discreet per-set remove — only shown when >1 set so the
                      last remaining set can't be removed (matches removeSet guard). */}
                  {ex.sets.length > 1 && (
                    <button
                      onClick={() => removeSet(exIdx, setIdx)}
                      title="Supprimer cette série"
                      aria-label="Supprimer cette série"
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        flexShrink: 0, background: 'transparent',
                        border: '1px solid var(--line)', color: 'var(--ink-faint)',
                        fontSize: 11, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Le décompte de repos s'affiche désormais dans un overlay
                    plein écran avec anneau (V8.3), rendu au niveau du composant. */}
              </div>
            ))}

            {/* Add a set during the workout — DA-styled affordance matching the
                maquette's "+ Ajouter" style (neon-soft bg, dashed neon border,
                var(--neon) text, full width). New sets flow through handleSave. */}
            <button
              onClick={() => addSet(exIdx)}
              style={{
                width: '100%', marginTop: 10, padding: '9px 12px', borderRadius: 8,
                background: 'var(--neon-soft)', border: '1px dashed var(--neon)',
                color: 'var(--neon)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '0.03em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              + Ajouter une série
            </button>
            </div>{/* fin contenu carte */}

            {/* Commentaire par exercice — toujours visible (maquette V8.3).
                Bindé sur ex.comment via updateExerciseComment ; inclus dans le
                payload de sauvegarde quand présent. */}
            <div style={{ padding: '0 14px 12px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
                background: 'var(--bg-raised)', borderRadius: 10, border: '1px solid var(--line)'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <input
                  type="text"
                  value={ex.comment ?? ''}
                  onChange={e => updateExerciseComment(exIdx, e.target.value)}
                  placeholder="Note / commentaire…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--ink)', padding: 0 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overlay timer de repos — anneau plein écran (V8.3). S'appuie sur la
          logique timestamp V8.2 (restLeft recalculé par syncRestTimers, donc
          continue en arrière-plan). Pause/Stop réutilisent les handlers par-set. */}
      {activeRest && !restMinimized && (() => {
        const pct = activeRest.total > 0 ? activeRest.left / activeRest.total : 0
        const R = 54, CIRC = 2 * Math.PI * R
        const mm = String(Math.floor(activeRest.left / 60)).padStart(2, '0')
        const ss = String(activeRest.left % 60).padStart(2, '0')
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 400,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
            animation: 'fadeSlide .18s ease',
          }}>
            {/* Bouton Réduire (option A) : bascule en pastille flottante, le repos continue */}
            <button
              onClick={() => setRestMinimized(true)}
              title="Réduire"
              aria-label="Réduire le minuteur de repos"
              style={{
                position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16,
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--bg-panel)', border: '1px solid var(--line)',
                color: 'var(--ink-dim)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
              </svg>
            </button>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 22 }}>
              Temps de repos
            </div>
            <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 26 }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="9" />
                <circle cx="80" cy="80" r={R} fill="none" stroke="var(--neon)" strokeWidth="9"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 40, color: 'var(--ink)', lineHeight: 1 }}>
                  {mm}:{ss}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6, maxWidth: 140, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeRest.exName}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => toggleRestPause(activeRest!.exIdx, activeRest!.setIdx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px', borderRadius: 12,
                  background: 'var(--bg-panel)', border: '1px solid var(--line)',
                  color: 'var(--ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {activeRest.paused ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z" /></svg> Reprendre</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> Pause</>
                )}
              </button>
              <button
                onClick={() => stopRestEarly(activeRest!.exIdx, activeRest!.setIdx)}
                style={{
                  padding: '11px 28px', borderRadius: 12,
                  background: 'var(--bg-panel)', border: '1px solid rgba(var(--neon-rgb),0.35)',
                  color: 'var(--neon)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Passer ›
              </button>
            </div>
          </div>
        )
      })()}

      {/* Pastille flottante de repos (option A) : affichée quand l'overlay est
          réduit. Mini-anneau + temps, tap pour ré-agrandir, bouton Passer rapide. */}
      {activeRest && restMinimized && (() => {
        const pct = activeRest.total > 0 ? activeRest.left / activeRest.total : 0
        const r = 15, circ = 2 * Math.PI * r
        const mm = String(Math.floor(activeRest.left / 60)).padStart(2, '0')
        const ss = String(activeRest.left % 60).padStart(2, '0')
        return (
          <div
            onClick={() => setRestMinimized(false)}
            title="Agrandir le minuteur de repos"
            style={{
              position: 'fixed', left: '50%', bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
              transform: 'translateX(-50%)', zIndex: 400, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 10px 8px 8px', borderRadius: 999,
              background: 'var(--bg-panel)', border: '1px solid rgba(var(--neon-rgb),0.35)',
              boxShadow: '0 8px 28px -6px rgba(0,0,0,0.55), 0 0 20px rgba(var(--neon-rgb),0.12)',
            }}
          >
            {/* mini-anneau */}
            <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
              <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
                <circle cx="20" cy="20" r={r} fill="none" stroke="var(--neon)" strokeWidth="4"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              {activeRest.paused && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--neon)"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, color: 'var(--neon)' }}>{mm}:{ss}</span>
              <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>repos</span>
            </div>
            {/* Passer (stop) sans agrandir */}
            <button
              onClick={(e) => { e.stopPropagation(); stopRestEarly(activeRest!.exIdx, activeRest!.setIdx) }}
              title="Passer le repos"
              aria-label="Passer le repos"
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 999,
                background: 'var(--neon-soft)', border: '1px solid rgba(var(--neon-rgb),0.35)',
                color: 'var(--neon)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Passer ›
            </button>
          </div>
        )
      })()}

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
