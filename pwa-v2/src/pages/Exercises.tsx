import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

type SetMeasurementType = 'reps' | 'seconds'

interface Exercise {
  id: string
  name: string
  muscle: string
  description?: string
  created_by?: string
  is_default?: boolean
  set_measurement_type?: SetMeasurementType
}

// Defensive default for rows lacking the field (backward compatibility)
function getMeasurementType(ex: Pick<Exercise, 'set_measurement_type'>): SetMeasurementType {
  return ex.set_measurement_type === 'seconds' ? 'seconds' : 'reps'
}

const MUSCLES = ['Tous', 'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Fessiers', 'Abdos', 'Cardio']

export default function PageExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [muscle, setMuscle] = useState('Tous')
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('Pectoraux')
  const [newDesc, setNewDesc] = useState('')
  const [newMeasurementType, setNewMeasurementType] = useState<SetMeasurementType>('reps')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadExercises()
  }, [])

  async function loadExercises() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name')

    // Apply defensive default 'reps' for rows lacking set_measurement_type
    const normalized = (data || []).map((ex: Exercise) => ({
      ...ex,
      set_measurement_type: getMeasurementType(ex),
    }))

    setExercises(normalized)
    setLoading(false)
  }

  async function addExercise() {
    if (!newName.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: newName.trim(),
        muscle: newMuscle,
        description: newDesc.trim() || null,
        set_measurement_type: newMeasurementType,
        created_by: user.id,
        is_default: false,
      })
      .select()
      .single()

    if (!error && data) {
      const saved: Exercise = { ...data, set_measurement_type: getMeasurementType(data) }
      setExercises(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
      setShowModal(false)
      setNewName('')
      setNewMuscle('Pectoraux')
      setNewDesc('')
      setNewMeasurementType('reps')
    }
    setSaving(false)
  }

  async function deleteExercise(id: string) {
    if (!confirm('Supprimer cet exercice ?')) return
    await supabase.from('exercises').delete().eq('id', id)
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  const filtered = exercises.filter(e =>
    (muscle === 'Tous' || e.muscle === muscle) &&
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-h1 display">Exercices</h2>
        </div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-faint)' }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Exercices</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Nouveau</button>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Rechercher…"
          className="search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 14 }}
        />
      </div>

      {/* Muscle filter chips */}
      <div className="muscle-chips">
        {MUSCLES.map(m => (
          <button key={m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(m)}>{m}</button>
        ))}
      </div>

      {/* Exercises grid */}
      <div className="ex-library-list">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--ink-faint)', gridColumn: '1 / -1' }}>
            Aucun exercice trouvé
          </div>
        )}
        {filtered.map(ex => (
          <TiltCard key={ex.id} className="ex-lib-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="ex-lib-name">{ex.name}</div>
                <div className="ex-lib-muscle">{ex.muscle}</div>
              </div>
              {/* Delete only if user-created */}
              {userId && ex.created_by === userId && !ex.is_default && (
                <button
                  className="btn-ghost btn-sm"
                  style={{ color: '#ff5555', fontSize: 11, padding: '4px 8px' }}
                  onClick={() => deleteExercise(ex.id)}
                >
                  ✕
                </button>
              )}
            </div>
          </TiltCard>
        ))}
      </div>

      {/* Add exercise modal */}
      {showModal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}
            onClick={() => setShowModal(false)}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: 24,
            width: 'min(360px, 90vw)',
            zIndex: 1001,
          }}>
            <h3 style={{ margin: '0 0 16px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>
              Nouvel exercice
            </h3>

            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>Nom</label>
              <input
                type="text"
                placeholder="Ex: Développé couché"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14 }}
              />
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>Muscle</label>
              <select
                value={newMuscle}
                onChange={e => setNewMuscle(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14 }}
              >
                {MUSCLES.filter(m => m !== 'Tous').map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>Type de mesure</label>
              <select
                value={newMeasurementType}
                onChange={e => setNewMeasurementType(e.target.value as SetMeasurementType)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14 }}
              >
                <option value="reps">Reps</option>
                <option value="seconds">Secondes</option>
              </select>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>Description (optionnel)</label>
              <textarea
                placeholder="Notes sur l'exercice…"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={addExercise} disabled={saving || !newName.trim()}>
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
