import { useState, useEffect, type FormEvent } from 'react'
import { TiltCard } from '../components/TiltCard'
import { supabase } from '../lib/supabase'
import type { WorkoutState, WorkoutExercise, WorkoutSet } from '../components/WorkoutScreen'

interface ProgramExercise {
  id: string
  name: string
  muscle: string
  sets: number
  repsTarget: string
  restSec: number
  tempo?: string
}

interface ProgramDay {
  id: string
  name: string
  weekdays: number[]
  exercises: ProgramExercise[]
}

interface Program {
  id: string
  user_id: string
  name: string
  goal: string
  days: ProgramDay[]
}

// Muscle list mirrors the pattern used in Exercises.tsx (without the "Tous" filter option)
const MUSCLES = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Fessiers', 'Abdos', 'Cardio']

function makeId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newExercise(): ProgramExercise {
  return { id: makeId(), name: '', muscle: 'Pectoraux', sets: 3, repsTarget: '8-12', restSec: 90, tempo: '' }
}

function newDay(index: number): ProgramDay {
  return { id: makeId(), name: `Jour ${index + 1}`, weekdays: [], exercises: [] }
}

// Short weekday labels (index 0 = Lundi ... 6 = Dimanche)
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

interface PageProgramsProps {
  onStartWorkout?: (workout: WorkoutState) => void
}

// Cardio muscle names to filter out
const CARDIO_MUSCLES = ['cardio', 'course', 'vélo', 'rameur', 'elliptique', 'corde à sauter']

function isCardioExercise(muscle: string): boolean {
  return CARDIO_MUSCLES.some(c => muscle.toLowerCase().includes(c))
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

export default function PagePrograms({ onStartWorkout }: PageProgramsProps) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [saving, setSaving] = useState(false)

  // Day/exercise editor state — draft days per program while editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftDays, setDraftDays] = useState<ProgramDay[]>([])
  const [savingDays, setSavingDays] = useState(false)
  const [libraryNames, setLibraryNames] = useState<string[]>([])
  // Map of exercise name -> its set measurement type (from the exercises library)
  const [libraryTypes, setLibraryTypes] = useState<Record<string, 'reps' | 'seconds'>>({})

  // Normalize legacy programs so repsTarget is always a string
  function normalizeProgram(p: Program): Program {
    return {
      ...p,
      days: (p.days || []).map(d => ({
        ...d,
        weekdays: (d.weekdays || []).map(Number),
        exercises: (d.exercises || []).map(ex => ({
          ...ex,
          repsTarget: ex.repsTarget == null ? '' : String(ex.repsTarget),
          tempo: ex.tempo ?? '',
        })),
      })),
    }
  }

  async function loadPrograms() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    setPrograms(((data as Program[]) || []).map(normalizeProgram))
    setLoading(false)
  }

  async function loadLibraryNames() {
    const { data } = await supabase
      .from('exercises')
      .select('name, set_measurement_type')
      .order('name')
    const rows = (data as { name: string; set_measurement_type?: string }[]) || []
    setLibraryNames(rows.map(e => e.name))
    const typeMap: Record<string, 'reps' | 'seconds'> = {}
    for (const e of rows) {
      typeMap[e.name] = e.set_measurement_type === 'seconds' ? 'seconds' : 'reps'
    }
    setLibraryTypes(typeMap)
  }

  useEffect(() => { loadPrograms(); loadLibraryNames() }, [])

  // ---- Day/exercise editor helpers ----
  function startEditing(p: Program) {
    setEditingId(p.id)
    setDraftDays(structuredClone(p.days || []))
  }

  function cancelEditing() {
    setEditingId(null)
    setDraftDays([])
  }

  function addDay() {
    setDraftDays(prev => [...prev, newDay(prev.length)])
  }

  function removeDay(dayIdx: number) {
    setDraftDays(prev => prev.filter((_, i) => i !== dayIdx))
  }

  function updateDayName(dayIdx: number, name: string) {
    setDraftDays(prev => prev.map((d, i) => (i === dayIdx ? { ...d, name } : d)))
  }

  function toggleWeekday(dayIdx: number, wd: number) {
    setDraftDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      const current = d.weekdays || []
      const next = current.includes(wd)
        ? current.filter(w => w !== wd)
        : [...current, wd].sort((a, b) => a - b)
      return { ...d, weekdays: next }
    }))
  }

  function addExerciseToDay(dayIdx: number) {
    setDraftDays(prev => prev.map((d, i) =>
      i === dayIdx ? { ...d, exercises: [...(d.exercises || []), newExercise()] } : d
    ))
  }

  function removeExerciseFromDay(dayIdx: number, exIdx: number) {
    setDraftDays(prev => prev.map((d, i) =>
      i === dayIdx ? { ...d, exercises: (d.exercises || []).filter((_, j) => j !== exIdx) } : d
    ))
  }

  function updateExerciseField<K extends keyof ProgramExercise>(dayIdx: number, exIdx: number, field: K, value: ProgramExercise[K]) {
    setDraftDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      return {
        ...d,
        exercises: (d.exercises || []).map((ex, j) => (j === exIdx ? { ...ex, [field]: value } : ex)),
      }
    }))
  }

  async function saveDays(programId: string) {
    setSavingDays(true)
    const { error } = await supabase
      .from('programs')
      .update({ days: draftDays })
      .eq('id', programId)

    setSavingDays(false)
    if (error) {
      showToast('Erreur lors de la sauvegarde', 'error')
      return
    }
    showToast('Programme enregistré', 'success')
    setEditingId(null)
    setDraftDays([])
    loadPrograms()
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase.from('programs').insert({
      user_id: user.id,
      name: newName.trim(),
      goal: newGoal.trim(),
      days: [],
    })

    setNewName('')
    setNewGoal('')
    setShowModal(false)
    setSaving(false)
    loadPrograms()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme ?')) return
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Programmes</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Créer un programme</button>
      </div>

      {programs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-faint)', fontSize: 13 }}>
          Aucun programme. Crée ton premier programme !
        </div>
      )}

      {programs.map((p) => (
        <TiltCard key={p.id} className="prog-card" style={{ marginBottom: 12 }}>
          <div className="prog-card-head" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
            <div>
              <div className="prog-name">{p.name}</div>
              <div className="prog-goal">{p.goal || '—'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--neon)' }}>
                  {(p.days || []).length}j
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                  {(p.days || []).reduce((acc, d) => acc + (d.exercises || []).length, 0)} exos
                </div>
              </div>
              <button
                className="btn-icon"
                style={{ width: 28, height: 28, borderRadius: 7 }}
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                title="Supprimer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded days (read-only) — hidden while editing */}
          {expandedId === p.id && editingId !== p.id && (p.days || []).length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              {(p.days || []).map((day, di) => (
                <div key={day.id || di} style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{day.name || `Jour ${di + 1}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                        {(day.exercises || []).length} exercice{(day.exercises || []).length > 1 ? 's' : ''}
                      </div>
                    </div>
                    {onStartWorkout && (day.exercises || []).length > 0 && (
                      <button
                        className="btn-train"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Filter out cardio exercises
                          const cardioExs = (day.exercises || []).filter(ex => isCardioExercise(ex.muscle))
                          const muscuExs = (day.exercises || []).filter(ex => !isCardioExercise(ex.muscle))

                          if (cardioExs.length > 0) {
                            showToast(`${cardioExs.length} exo(s) cardio ignoré(s) — fais-les séparément !`, 'info')
                          }

                          if (muscuExs.length === 0) {
                            showToast('Aucun exercice muscu dans ce jour', 'error')
                            return
                          }

                          const workoutExercises: WorkoutExercise[] = muscuExs.map(ex => ({
                            name: ex.name,
                            muscle: ex.muscle,
                            restSec: ex.restSec || 90,
                            completed: false,
                            measurementType: libraryTypes[ex.name] || 'reps',
                            tempo: ex.tempo,
                            sets: Array.from({ length: ex.sets || 3 }, (): WorkoutSet => ({
                              weight: '',
                              reps: ex.repsTarget || '',
                              duration: '',
                              rpe: '',
                              done: false,
                              restLeft: 0,
                              restPaused: false
                            }))
                          }))

                          onStartWorkout({
                            progId: p.id,
                            dayId: day.id || `day-${di}`,
                            dayName: day.name || `Jour ${di + 1}`,
                            progName: p.name,
                            startTs: Date.now(),
                            exercises: workoutExercises
                          })
                        }}
                      >
                        Lancer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {expandedId === p.id && editingId !== p.id && (p.days || []).length === 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-faint)' }}>
              Aucun jour configuré
            </div>
          )}

          {/* Edit toggle */}
          {expandedId === p.id && editingId !== p.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); startEditing(p) }}>
                Éditer les jours
              </button>
            </div>
          )}

          {/* Day / exercise editor */}
          {expandedId === p.id && editingId === p.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
              {/* datalist of library exercise names (shared across inputs) */}
              <datalist id={`ex-names-${p.id}`}>
                {libraryNames.map(n => <option key={n} value={n} />)}
              </datalist>

              {draftDays.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 10 }}>
                  Aucun jour. Ajoute un jour pour commencer.
                </div>
              )}

              {draftDays.map((day, di) => (
                <div key={day.id || di} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-raised)', borderRadius: 10, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <input
                      type="text"
                      value={day.name}
                      placeholder={`Jour ${di + 1}`}
                      onChange={e => updateDayName(di, e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}
                    />
                    <button
                      className="btn-icon"
                      style={{ width: 28, height: 28, borderRadius: 7 }}
                      title="Supprimer le jour"
                      onClick={() => removeDay(di)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4 }}>Jours de la semaine</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {WEEKDAY_LABELS.map((label, wd) => {
                        const active = (day.weekdays || []).includes(wd)
                        return (
                          <button
                            key={wd}
                            type="button"
                            onClick={() => toggleWeekday(di, wd)}
                            title={`Jour ${wd + 1}`}
                            style={{
                              flex: 1,
                              padding: '6px 0',
                              borderRadius: 7,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: active ? '1px solid var(--neon)' : '1px solid var(--line)',
                              background: active ? 'var(--neon)' : 'var(--bg-raised)',
                              color: active ? '#0a0c0f' : 'var(--ink-dim)',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {(day.exercises || []).map((ex, ei) => (
                    <div key={ex.id || ei} style={{ marginBottom: 8, padding: 10, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <input
                          type="text"
                          list={`ex-names-${p.id}`}
                          value={ex.name}
                          placeholder="Nom de l'exercice"
                          onChange={e => updateExerciseField(di, ei, 'name', e.target.value)}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                        />
                        <button
                          className="btn-icon"
                          style={{ width: 26, height: 26, borderRadius: 7 }}
                          title="Supprimer l'exercice"
                          onClick={() => removeExerciseFromDay(di, ei)}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        <label style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                          Muscle
                          <select
                            value={MUSCLES.includes(ex.muscle) ? ex.muscle : ''}
                            onChange={e => updateExerciseField(di, ei, 'muscle', e.target.value)}
                            style={{ width: '100%', marginTop: 2, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                          >
                            {!MUSCLES.includes(ex.muscle) && <option value="">{ex.muscle || '—'}</option>}
                            {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </label>

                        <label style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                          Séries
                          <input
                            type="number"
                            min={1}
                            value={ex.sets}
                            onChange={e => updateExerciseField(di, ei, 'sets', parseInt(e.target.value, 10) || 0)}
                            style={{ width: '100%', marginTop: 2, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                          />
                        </label>

                        <label style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                          Reps (ex: 8-12)
                          <input
                            type="text"
                            value={ex.repsTarget}
                            placeholder="8-12"
                            onChange={e => updateExerciseField(di, ei, 'repsTarget', e.target.value)}
                            style={{ width: '100%', marginTop: 2, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                          />
                        </label>

                        <label style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                          Repos (s)
                          <input
                            type="number"
                            min={0}
                            value={ex.restSec}
                            onChange={e => updateExerciseField(di, ei, 'restSec', parseInt(e.target.value, 10) || 0)}
                            style={{ width: '100%', marginTop: 2, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                          />
                        </label>

                        <label style={{ fontSize: 10, color: 'var(--ink-faint)', gridColumn: '1 / -1' }}>
                          Tempo (optionnel, ex: 3-0-1)
                          <input
                            type="text"
                            value={ex.tempo ?? ''}
                            placeholder="3-0-1"
                            onChange={e => updateExerciseField(di, ei, 'tempo', e.target.value)}
                            style={{ width: '100%', marginTop: 2, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  <button className="btn-ghost btn-sm" onClick={() => addExerciseToDay(di)} style={{ marginTop: 4 }}>
                    + Ajouter un exercice
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button className="btn-ghost btn-sm" onClick={addDay}>+ Ajouter un jour</button>
                <div style={{ flex: 1 }} />
                <button className="btn-ghost btn-sm" onClick={cancelEditing} disabled={savingDays}>Annuler</button>
                <button className="btn-primary btn-sm" onClick={() => saveDays(p.id)} disabled={savingDays}>
                  {savingDays ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </TiltCard>
      ))}

      {/* Create modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--bg-panel)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, border: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Créer un programme</h3>
            <form onSubmit={handleCreate}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--ink-faint)' }}>Nom du programme</label>
                <input
                  type="text"
                  placeholder="Ex: PPL 6 jours"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14 }}
                />
              </div>
              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--ink-faint)' }}>Objectif</label>
                <input
                  type="text"
                  placeholder="Ex: Prise de masse"
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
