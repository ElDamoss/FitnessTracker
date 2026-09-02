import { useState, useEffect } from 'react'
import { TiltCard } from '../components/TiltCard'
import { supabase } from '../lib/supabase'
import type { WorkoutState, WorkoutExercise, WorkoutSet } from '../components/WorkoutScreen'
import ModalNewProgram, { type ProgramDay, type ProgramExercise, type CatalogItem } from '../components/ModalNewProgram'

interface Program {
  id: string
  user_id: string
  name: string
  goal: string
  days: ProgramDay[]
}

function makeId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

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

  // Rich 2-step modal state (maquette ModalNewProgram)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalProgramId, setModalProgramId] = useState<string | null>(null) // null = create
  const [modalInitialStep, setModalInitialStep] = useState<1 | 2>(1)
  const [modalEditingDayId, setModalEditingDayId] = useState<string | undefined>(undefined)

  // Exercise library used to feed the modal catalog + measurement types
  const [libraryCatalog, setLibraryCatalog] = useState<CatalogItem[]>([])
  const [libraryTypes, setLibraryTypes] = useState<Record<string, 'reps' | 'seconds'>>({})

  // Normalize legacy programs: backfill additive fields (mode/time/rpeEnabled/rpe/restSec/tempo)
  function normalizeProgram(p: Program): Program {
    return {
      ...p,
      days: (p.days || []).map(d => ({
        ...d,
        id: d.id || makeId(),
        weekdays: (d.weekdays || []).map(Number),
        exercises: (d.exercises || []).map((ex): ProgramExercise => {
          const repsTarget = ex.repsTarget == null ? '' : String(ex.repsTarget)
          const inferredMode: 'reps' | 'time' =
            ex.mode === 'time' || ex.mode === 'reps'
              ? ex.mode
              : (libraryTypes[ex.name] === 'seconds' ? 'time' : 'reps')
          return {
            id: ex.id || makeId(),
            name: ex.name,
            muscle: ex.muscle,
            sets: ex.sets,
            repsTarget,
            restSec: ex.restSec == null ? 90 : Number(ex.restSec),
            tempo: ex.tempo ?? '',
            mode: inferredMode,
            time: ex.time == null ? '' : String(ex.time),
            rpeEnabled: ex.rpeEnabled ?? false,
            rpe: ex.rpe ?? '',
          }
        }),
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
      .select('name, muscle, set_measurement_type')
      .order('name')
    const rows = (data as { name: string; muscle?: string; set_measurement_type?: string }[]) || []
    setLibraryCatalog(rows.map(e => ({ name: e.name, muscle: e.muscle || '—' })))
    const typeMap: Record<string, 'reps' | 'seconds'> = {}
    for (const e of rows) {
      typeMap[e.name] = e.set_measurement_type === 'seconds' ? 'seconds' : 'reps'
    }
    setLibraryTypes(typeMap)
  }

  useEffect(() => { loadPrograms(); loadLibraryNames() }, [])

  // ── Modal openers ──
  function openCreate() {
    setModalProgramId(null)
    setModalInitialStep(1)
    setModalEditingDayId(undefined)
    setModalOpen(true)
  }

  function openEditDay(p: Program, day: ProgramDay) {
    setModalProgramId(p.id)
    setModalInitialStep(2)
    setModalEditingDayId(day.id)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setModalProgramId(null)
    setModalEditingDayId(undefined)
  }

  const editingProgram = modalProgramId ? programs.find(p => p.id === modalProgramId) ?? null : null

  // ── Save (create or update) via Supabase ──
  async function handleSaveModal(payload: { name: string; goal: string; days: ProgramDay[] }) {
    if (modalProgramId) {
      const { error } = await supabase
        .from('programs')
        .update({ name: payload.name, goal: payload.goal, days: payload.days })
        .eq('id', modalProgramId)
      if (error) { showToast('Erreur lors de la sauvegarde', 'error'); return }
      showToast('Programme enregistré', 'success')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('programs').insert({
        user_id: user.id,
        name: payload.name,
        goal: payload.goal,
        days: payload.days,
      })
      if (error) { showToast('Erreur lors de la création', 'error'); return }
      showToast('Programme créé', 'success')
    }
    loadPrograms()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme ?')) return
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
  }

  // ── Launch a workout from a program day (preserves cardio filtering + mapping §7) ──
  function launchDay(p: Program, day: ProgramDay, di: number) {
    if (!onStartWorkout) return
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
        <button className="btn-primary" onClick={openCreate}>+ Créer un programme</button>
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

          {/* Expanded days — each row has a pencil (edit) + "Lancer" */}
          {expandedId === p.id && (p.days || []).length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              {(p.days || []).map((day, di) => (
                <div key={day.id || di} style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{day.name || `Jour ${di + 1}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                        {(day.exercises || []).length} exercice{(day.exercises || []).length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Pencil : open modal at step 2 on this day (Exigence 2) */}
                      <button
                        className="btn-icon"
                        style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: 'var(--neon-soft)', border: '1px solid rgba(var(--neon-rgb),0.3)',
                          color: 'var(--neon)',
                        }}
                        title="Modifier ce jour"
                        onClick={(e) => { e.stopPropagation(); openEditDay(p, day) }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      {onStartWorkout && (day.exercises || []).length > 0 && (
                        <button
                          className="btn-train"
                          onClick={(e) => { e.stopPropagation(); launchDay(p, day, di) }}
                        >
                          Lancer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {expandedId === p.id && (p.days || []).length === 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Aucun jour configuré</div>
              <button
                className="btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={(e) => { e.stopPropagation(); setModalProgramId(p.id); setModalInitialStep(2); setModalEditingDayId(undefined); setModalOpen(true) }}
              >
                Éditer les jours
              </button>
            </div>
          )}
        </TiltCard>
      ))}

      {/* Rich 2-step create/edit modal (maquette) */}
      {modalOpen && (
        <ModalNewProgram
          onClose={closeModal}
          onSave={handleSaveModal}
          catalog={libraryCatalog}
          libraryTypes={libraryTypes}
          initialName={editingProgram?.name}
          initialGoal={editingProgram?.goal || 'Prise de masse'}
          initialDays={editingProgram ? editingProgram.days : (modalProgramId ? [] : undefined)}
          initialStep={modalInitialStep}
          editingDayId={modalEditingDayId}
        />
      )}
    </div>
  )
}
