import { useState } from 'react'

// ── Types (maquette ExMode/ProgDay reconciled with prod data model §8) ──────
// The maquette exercise has { name, muscle, sets, reps, mode, time, rpeEnabled, rpe }.
// Prod persists { id, name, muscle, sets, repsTarget, restSec, tempo, mode, time, rpeEnabled, rpe }.
// We keep the additive prod shape here so the modal writes the full record.
export type ExMode = 'reps' | 'time'

export interface ProgramExercise {
  id: string
  name: string
  muscle: string
  sets: number
  repsTarget: string      // maquette "reps" maps here
  restSec: number         // preserved (default 90)
  tempo?: string          // preserved (optional)
  mode: ExMode            // added
  time: string            // added (seconds value when mode==='time')
  rpeEnabled: boolean     // added
  rpe: string             // added
}

export interface ProgramDay {
  id: string
  name: string
  weekdays: number[]
  exercises: ProgramExercise[]
}

export interface CatalogItem {
  name: string
  muscle: string
}

// ── Constants (verbatim from maquette) ──────────────────────────────────────
export const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const GOALS = ['Prise de masse', 'Sèche', 'Force', 'Endurance', 'Général']

function makeId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface ModalNewProgramProps {
  onClose: () => void
  onSave: (p: { name: string; goal: string; days: ProgramDay[] }) => void
  // Catalog sourced from the Supabase exercise library (name + muscle)
  catalog: CatalogItem[]
  // Map of exercise name -> measurement type, used to init `mode` on add
  libraryTypes?: Record<string, 'reps' | 'seconds'>
  // Edit mode: seed the modal with existing program data
  initialName?: string
  initialGoal?: string
  initialDays?: ProgramDay[]
  initialStep?: 1 | 2
  // When opening in step 2 on a specific day, its id to preselect
  editingDayId?: string
}

export default function ModalNewProgram({
  onClose,
  onSave,
  catalog,
  libraryTypes = {},
  initialName = '',
  initialGoal = 'Prise de masse',
  initialDays,
  initialStep = 1,
  editingDayId,
}: ModalNewProgramProps) {
  const [step, setStep] = useState<1 | 2>(initialStep)
  const [name, setName] = useState(initialName)
  const [goal, setGoal] = useState(initialGoal)
  const [days, setDays] = useState<ProgramDay[]>(initialDays ? structuredClone(initialDays) : [])
  const [editingDay, setEditingDay] = useState<ProgramDay | null>(() => {
    if (initialDays && editingDayId) return initialDays.find(d => d.id === editingDayId) ?? null
    return null
  })
  const [exSearch, setExSearch] = useState('')
  const [mobilePanel, setMobilePanel] = useState<'days' | 'editor' | 'catalog'>(
    initialStep === 2 && editingDayId ? 'editor' : 'days'
  )
  const [dayNameDraft, setDayNameDraft] = useState<string>(() => {
    if (initialDays && editingDayId) return initialDays.find(d => d.id === editingDayId)?.name ?? ''
    return ''
  })

  const addDay = () => {
    const nd: ProgramDay = { id: makeId(), name: '', weekdays: [], exercises: [] }
    setDays(d => [...d, nd])
    setEditingDay(nd)
    setDayNameDraft('')
  }

  const updateDay = (updated: ProgramDay) => {
    setDays(d => d.map(x => x.id === updated.id ? updated : x))
    setEditingDay(updated)
  }

  const selectDay = (d: ProgramDay) => {
    setEditingDay(d)
    setDayNameDraft(d.name)
  }

  const removeDay = (id: string) => {
    setDays(d => d.filter(x => x.id !== id))
    if (editingDay?.id === id) setEditingDay(null)
  }

  const toggleWeekday = (wd: number) => {
    if (!editingDay) return
    const wds = editingDay.weekdays.includes(wd)
      ? editingDay.weekdays.filter(d => d !== wd)
      : [...editingDay.weekdays, wd].sort((a, b) => a - b)
    updateDay({ ...editingDay, weekdays: wds })
  }

  const addExercise = (ex: CatalogItem) => {
    if (!editingDay) return
    if (editingDay.exercises.find(e => e.name === ex.name)) return
    const mode: ExMode = libraryTypes[ex.name] === 'seconds' ? 'time' : 'reps'
    const newEx: ProgramExercise = {
      id: makeId(),
      name: ex.name,
      muscle: ex.muscle,
      sets: 3,
      repsTarget: '10',
      restSec: 90,
      tempo: '',
      mode,
      time: '30',
      rpeEnabled: false,
      rpe: '',
    }
    updateDay({ ...editingDay, exercises: [...editingDay.exercises, newEx] })
  }

  const removeEx = (exName: string) => {
    if (!editingDay) return
    updateDay({ ...editingDay, exercises: editingDay.exercises.filter(e => e.name !== exName) })
  }

  // Réordonne l'exercice à l'index `idx` en l'échangeant avec son voisin
  // (dir = -1 monter, +1 descendre). L'ordre du tableau `exercises` définit
  // l'ordre d'exécution : il est persisté tel quel et repris au lancement.
  const moveEx = (idx: number, dir: -1 | 1) => {
    if (!editingDay) return
    const target = idx + dir
    if (target < 0 || target >= editingDay.exercises.length) return
    const next = [...editingDay.exercises]
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    updateDay({ ...editingDay, exercises: next })
  }

  const updateEx = (
    exName: string,
    field: 'sets' | 'reps' | 'mode' | 'time' | 'rpeEnabled' | 'rpe' | 'rest',
    val: string | number | boolean
  ) => {
    if (!editingDay) return
    // maquette 'reps' -> prod 'repsTarget' ; 'rest' -> prod 'restSec'
    const prodField = field === 'reps' ? 'repsTarget' : field === 'rest' ? 'restSec' : field
    updateDay({
      ...editingDay,
      exercises: editingDay.exercises.map(e => e.name === exName ? { ...e, [prodField]: val } : e),
    })
  }

  const filteredEx = catalog.filter(e =>
    !editingDay?.exercises.find(x => x.name === e.name) &&
    e.name.toLowerCase().includes(exSearch.toLowerCase())
  )

  const canNext = name.trim().length > 0
  const canSave = canNext && days.length > 0

  // ── sous-composant : carte exercice ──
  const ExCard = ({ ex, index, total }: { ex: ProgramExercise; index: number; total: number }) => (
    <div style={{ background: 'var(--bg-raised)', borderRadius: 12, marginBottom: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
      {/* ligne 1 : réordonner + nom + séries + mode + valeur + suppr */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        {/* Réordonner : monter / descendre (l'ordre = ordre d'exécution) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => moveEx(index, -1)}
            disabled={index === 0}
            title="Monter"
            aria-label="Monter l'exercice"
            style={{
              width: 24, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-panel)', border: '1px solid var(--line)', color: 'var(--ink-dim)',
              cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1, lineHeight: 1,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button
            onClick={() => moveEx(index, 1)}
            disabled={index === total - 1}
            title="Descendre"
            aria-label="Descendre l'exercice"
            style={{
              width: 24, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-panel)', border: '1px solid var(--line)', color: 'var(--ink-dim)',
              cursor: index === total - 1 ? 'not-allowed' : 'pointer', opacity: index === total - 1 ? 0.3 : 1, lineHeight: 1,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
          <div style={{ fontSize: 11, color: 'var(--neon)', fontWeight: 600, marginTop: 2 }}>{ex.muscle}</div>
        </div>
        {/* séries */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <input type="number" value={ex.sets} min={1} max={10}
            onChange={e => updateEx(ex.name, 'sets', Number(e.target.value))}
            style={{ width: 48, textAlign: 'center', padding: '6px 4px', fontSize: 15, fontWeight: 700, borderRadius: 8 }}
          />
          <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>séries</span>
        </div>
        <span style={{ color: 'var(--line)', fontSize: 16 }}>×</span>
        {/* toggle Reps / Temps */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {/* pills */}
          <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--line)', flexShrink: 0 }}>
            {(['reps', 'time'] as ExMode[]).map(m => (
              <button key={m} onClick={() => updateEx(ex.name, 'mode', m)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all .15s',
                background: ex.mode === m ? 'var(--neon)' : 'transparent',
                color: ex.mode === m ? '#0a0c0f' : 'var(--ink-faint)',
                border: 'none',
              }}>{m === 'reps' ? 'Reps' : 'Temps'}</button>
            ))}
          </div>
          {/* input valeur */}
          {ex.mode === 'reps' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <input type="text" value={ex.repsTarget}
                onChange={e => updateEx(ex.name, 'reps', e.target.value)}
                style={{ width: 62, textAlign: 'center', padding: '5px 4px', fontSize: 14, fontWeight: 700, borderRadius: 7 }}
              />
              <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>reps</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input type="number" value={ex.time}
                  onChange={e => updateEx(ex.name, 'time', e.target.value)}
                  style={{ width: 54, textAlign: 'center', padding: '5px 4px', fontSize: 14, fontWeight: 700, borderRadius: 7 }}
                />
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600 }}>s</span>
              </div>
              <span style={{ fontSize: 9, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>secondes</span>
            </div>
          )}
        </div>
        <button onClick={() => removeEx(ex.name)}
          style={{ color: 'var(--ink-faint)', fontSize: 16, padding: '4px 7px', borderRadius: 6, transition: 'color .15s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
        >✕</button>
      </div>
      {/* ligne 2a : temps de repos entre séries (aligné maquette V8.3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
          </svg>
          <input
            type="number" min={0} max={600}
            value={ex.restSec ?? 90}
            onChange={e => updateEx(ex.name, 'rest', parseInt(e.target.value) || 0)}
            style={{
              width: 56, textAlign: 'center', padding: '4px 6px', fontSize: 13, fontWeight: 700,
              borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-panel)',
              color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>s repos</span>
        </div>
      </div>

      {/* ligne 2b : RPE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px' }}>
        <div onClick={() => updateEx(ex.name, 'rpeEnabled', !ex.rpeEnabled)} style={{
          display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: `1.5px solid ${ex.rpeEnabled ? 'var(--neon)' : 'var(--line)'}`,
            background: ex.rpeEnabled ? 'var(--neon)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}>
            {ex.rpeEnabled && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0a0c0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: ex.rpeEnabled ? 'var(--neon)' : 'var(--ink-faint)', transition: 'color .15s' }}>RPE</span>
        </div>
        {ex.rpeEnabled && (
          <input type="text" placeholder="8 · 3-2-1 · @RPE9" value={ex.rpe}
            onChange={e => updateEx(ex.name, 'rpe', e.target.value)} autoFocus
            style={{
              flex: 1, padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8,
              border: '1px solid rgba(var(--neon-rgb),0.3)', background: 'var(--bg-panel)', color: 'var(--neon)',
              fontFamily: "'JetBrains Mono', monospace", animation: 'fadeSlide .15s ease',
            }}
          />
        )}
      </div>
    </div>
  )

  // ── colonne catalogue ──
  const CatalogCol = () => (
    <>
      <button className="prog-back-btn" onClick={() => setMobilePanel('editor')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Retour au jour
      </button>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
        {"Catalogue d'exercices"}
      </div>
      <input type="text" placeholder="Rechercher un exercice…" value={exSearch}
        onChange={e => setExSearch(e.target.value)}
        style={{ padding: '10px 14px', fontSize: 14, borderRadius: 10, marginBottom: 8, border: '1px solid var(--line)', background: 'var(--bg-raised)' }}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredEx.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '24px 0' }}>Aucun résultat</div>
        ) : filteredEx.map(ex => {
          const added = editingDay?.exercises.some(e => e.name === ex.name)
          return (
            <div key={ex.name} onClick={() => { if (editingDay && !added) addExercise(ex) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 14px', borderRadius: 10, cursor: added ? 'default' : 'pointer',
                opacity: added ? 0.45 : 1, transition: 'all .12s', marginBottom: 3,
                border: '1px solid transparent',
              }}
              onMouseEnter={e => { if (!added) { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.borderColor = 'var(--line)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: 'var(--neon)', marginTop: 2, fontWeight: 600 }}>{ex.muscle}</div>
              </div>
              {added
                ? <span style={{ color: 'var(--ink-faint)', fontSize: 12, fontWeight: 700 }}>✓</span>
                : <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--neon-soft)', border: '1px solid rgba(var(--neon-rgb),0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>+</div>
              }
            </div>
          )
        })}
      </div>
    </>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 'min(96vw, 980px)', width: '96vw', maxHeight: '90dvh' }}>

        {/* Header */}
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-dim)', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
            )}
            <span>{initialDays ? 'Modifier le programme' : 'Nouveau programme'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, transition: 'all .2s',
                  background: step >= s ? 'var(--neon)' : 'var(--bg-raised)',
                  color: step >= s ? '#0a0c0f' : 'var(--ink-faint)',
                  border: step >= s ? 'none' : '1px solid var(--line)',
                }}>{s}</div>
                {s < 2 && <div style={{ width: 20, height: 1, background: step > s ? 'var(--neon)' : 'var(--line)', transition: 'background .2s' }} />}
              </div>
            ))}
            <button className="modal-close" onClick={onClose} style={{ marginLeft: 6 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: 20 }}>

          {/* ── Étape 1 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 16 }}>Informations générales</div>
                <div className="field">
                  <label>Nom du programme *</label>
                  <input type="text" placeholder="Ex: Push Pull Legs, Full Body…"
                    value={name} onChange={e => setName(e.target.value)} autoFocus
                    style={{ fontSize: 15, fontWeight: 600 }}
                  />
                </div>
                <div className="field">
                  <label>Objectif</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {GOALS.map(g => (
                      <button key={g} onClick={() => setGoal(g)} style={{
                        padding: '9px 16px', borderRadius: 9, cursor: 'pointer', transition: 'all .15s',
                        background: goal === g ? 'var(--neon)' : 'var(--bg-raised)',
                        color: goal === g ? '#0a0c0f' : 'var(--ink-dim)',
                        border: goal === g ? 'none' : '1px solid var(--line)',
                        fontSize: 13, fontWeight: goal === g ? 700 : 500,
                      }}>{g}</button>
                    ))}
                  </div>
                </div>
              </div>
              {name && (
                <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--neon-soft)', border: '1px solid rgba(var(--neon-rgb),0.2)', animation: 'fadeSlide .2s ease' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: 6 }}>Aperçu</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--neon)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{goal}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 2 : layout responsive 3 colonnes ── */}
          {step === 2 && (
            <div className="prog-layout" style={{ minHeight: 480 }}>

              {/* col jours */}
              <div className={`prog-col-days${mobilePanel !== 'days' ? ' prog-mobile-hide' : ''}`}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
                  Jours ({days.length})
                </div>
                {days.map((d, i) => (
                  <div key={d.id} onClick={() => { selectDay(d); setMobilePanel('editor') }} style={{
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all .15s',
                    background: editingDay?.id === d.id ? 'var(--neon-soft)' : 'var(--bg-raised)',
                    border: `1px solid ${editingDay?.id === d.id ? 'rgba(var(--neon-rgb),0.35)' : 'var(--line)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: editingDay?.id === d.id ? 'var(--neon)' : 'var(--ink)' }}>
                        {d.name || `Jour ${i + 1}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{d.exercises.length} exo{d.exercises.length !== 1 ? 's' : ''}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeDay(d.id) }}
                      style={{ color: 'var(--ink-faint)', fontSize: 14, padding: '3px 6px', borderRadius: 5, transition: 'color .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}
                    >✕</button>
                  </div>
                ))}
                <button onClick={addDay} style={{
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all .15s', marginTop: 4,
                  background: 'transparent', border: '1px dashed rgba(var(--neon-rgb),0.3)',
                  color: 'var(--neon)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Ajouter un jour
                </button>
              </div>

              {/* col éditeur */}
              <div className={`prog-col-editor${mobilePanel === 'catalog' ? ' prog-mobile-hide' : ''}${mobilePanel === 'days' ? ' prog-mobile-hide' : ''}`}>
                {!editingDay ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 13, gap: 14, padding: '40px 0' }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25"><rect x="3" y="4" width="18" height="17" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
                    Sélectionne ou crée un jour
                  </div>
                ) : (
                  <>
                    <button className="prog-back-btn" onClick={() => setMobilePanel('days')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                      Tous les jours
                    </button>
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label>Nom de la séance</label>
                      <input type="text" placeholder="Ex: Push, Lundi, Upper A…"
                        value={dayNameDraft}
                        onChange={e => setDayNameDraft(e.target.value)}
                        onBlur={() => updateDay({ ...editingDay, name: dayNameDraft })}
                        style={{ fontSize: 15, fontWeight: 600 }}
                      />
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>Jours de la semaine</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {WEEKDAY_LABELS.map((l, i) => (
                          <button key={i} onClick={() => toggleWeekday(i)} style={{
                            width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
                            background: editingDay.weekdays.includes(i) ? 'var(--neon)' : 'var(--bg-raised)',
                            color: editingDay.weekdays.includes(i) ? '#0a0c0f' : 'var(--ink-faint)',
                            boxShadow: editingDay.weekdays.includes(i) ? '0 2px 10px var(--neon-soft)' : 'none',
                            transition: 'all .15s',
                          }}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                      Exercices ({editingDay.exercises.length})
                    </div>
                    {editingDay.exercises.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-faint)', fontSize: 13 }}>
                        Aucun exercice — ajoutes-en via le catalogue
                      </div>
                    )}
                    {editingDay.exercises.map((ex, i) => <ExCard key={ex.id} ex={ex} index={i} total={editingDay.exercises.length} />)}
                    <button className="prog-back-btn" onClick={() => setMobilePanel('catalog')} style={{ display: 'flex', padding: '14px 0 0 0', color: 'var(--neon)', fontSize: 14, fontWeight: 700, gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--neon-soft)', border: '1px solid rgba(var(--neon-rgb),0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }}>+</div>
                      Ajouter un exercice
                    </button>
                  </>
                )}
              </div>

              {/* col catalogue */}
              <div className={`prog-col-catalog${mobilePanel !== 'catalog' ? ' prog-mobile-hide' : ''}`}>
                <CatalogCol />
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === 2 && mobilePanel === 'catalog' ? (
            <button className="btn-ghost" onClick={() => setMobilePanel('editor')}>← Retour</button>
          ) : (
            <button className="btn-ghost" onClick={onClose}>Annuler</button>
          )}
          {step === 1 ? (
            <button className="btn-primary" onClick={() => { setStep(2); if (!editingDay) setMobilePanel('days') }} disabled={!canNext} style={{ opacity: canNext ? 1 : 0.4 }}>
              Suivant →
            </button>
          ) : (
            <button className="btn-primary" onClick={() => { onSave({ name, goal, days }); onClose() }} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
              {initialDays ? 'Enregistrer' : 'Créer le programme'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
