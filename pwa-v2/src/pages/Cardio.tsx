import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

// ── Types ──
interface CardioSession {
  id: string
  name: string
  date: string
  duration_min: number
  duration_sec: number
  cardio_type: string
  vitesse: number | null
  inclinaison: number | null
  calories: number | null
}

// ── MET Calculation ──
function calcCalories(_type: string, poidsKg: number, durationMin: number, vitesse: number, inclinaison: number): number {
  let met = 7.0
  if (vitesse) {
    if (vitesse <= 4) met = 2.5
    else if (vitesse <= 6) met = 4.3
    else if (vitesse <= 8) met = 7.0
    else if (vitesse <= 10) met = 9.8
    else if (vitesse <= 12) met = 11.5
    else met = 14.5
  }
  if (inclinaison && inclinaison > 0) met += inclinaison * 0.3
  return Math.round(met * poidsKg * (durationMin / 60))
}

// ── Cardio type labels ──
const TYPE_LABELS: Record<string, string> = {
  'marche_lente': 'Marche lente',
  'marche_rapide': 'Marche rapide',
  'marche_sportive': 'Marche sportive',
  'course_lente': 'Course lente',
  'course_moderee': 'Course modérée',
  'course_rapide': 'Course rapide',
  'course_intense': 'Course intense',
  'fractionne': 'Fractionné',
  'tapis_plat': 'Tapis plat',
  'tapis_incline': 'Tapis incliné',
  'tapis_forte_incl': 'Tapis forte inclinaison',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PageCardio() {
  const [sessions, setSessions] = useState<CardioSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Modal form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formType, setFormType] = useState('course_moderee')
  const [formDuration, setFormDuration] = useState('')
  const [formVitesse, setFormVitesse] = useState('')
  const [formInclinaison, setFormInclinaison] = useState('')

  const fetchSessions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('sessions')
      .select('id, name, date, duration_min, duration_sec, cardio_type, vitesse, inclinaison, calories')
      .eq('user_id', user.id)
      .eq('cardio', true)
      .order('date', { ascending: false })

    if (!error && data) {
      setSessions(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // ── Preview calories ──
  const previewCalories = (): number => {
    const duration = parseFloat(formDuration) || 0
    const vitesse = parseFloat(formVitesse) || 0
    const inclinaison = parseFloat(formInclinaison) || 0
    const poids = parseFloat(localStorage.getItem('mt_user_poids') || '70')
    if (duration <= 0) return 0
    return calcCalories(formType, poids, duration, vitesse, inclinaison)
  }

  // ── Save cardio session ──
  const handleSave = async () => {
    const duration = parseFloat(formDuration) || 0
    if (!formDate || duration <= 0) return

    const vitesse = parseFloat(formVitesse) || 0
    const inclinaison = parseFloat(formInclinaison) || 0
    const poids = parseFloat(localStorage.getItem('mt_user_poids') || '70')
    const calories = calcCalories(formType, poids, duration, vitesse, inclinaison)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const session = {
      user_id: user.id,
      name: TYPE_LABELS[formType] || 'Cardio',
      date: formDate,
      duration_sec: Math.round(duration * 60),
      duration_min: duration,
      notes: '',
      exercises: [],
      cardio: true,
      cardio_type: formType,
      vitesse: vitesse || null,
      inclinaison: inclinaison || null,
      calories,
    }

    const { error } = await supabase.from('sessions').insert(session)
    if (!error) {
      setShowModal(false)
      resetForm()
      fetchSessions()
    }
  }

  // ── Delete session ──
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette séance cardio ?')) return
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== id))
    }
  }

  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0])
    setFormType('course_moderee')
    setFormDuration('')
    setFormVitesse('')
    setFormInclinaison('')
  }

  const openModal = () => {
    resetForm()
    setShowModal(true)
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h2 className="page-h1 display">Cardio & Calories</h2>
        <button className="btn-primary" onClick={openModal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Ajouter
        </button>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : sessions.length === 0 ? (
        <TiltCard style={{ padding: 24 }}>
          <div className="empty-state">Aucune activité cardio enregistrée</div>
        </TiltCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map(session => (
            <TiltCard key={session.id} className="cardio-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="cardio-card-name">{session.name}</span>
                <span className="cardio-card-date">{formatDate(session.date)}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 16, color: 'var(--neon)' }}>{session.calories || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>kcal</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 16 }}>{session.duration_min || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>min</div>
                </div>
                {session.vitesse ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 16 }}>{session.vitesse}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>km/h</div>
                  </div>
                ) : null}
                {session.inclinaison ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 16 }}>{session.inclinaison}%</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>pente</div>
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button className="btn-icon" onClick={() => handleDelete(session.id)} title="Supprimer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </TiltCard>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>Nouvelle séance cardio</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Date</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Type d'activité</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Durée (minutes)</label>
                <input type="number" placeholder="30" value={formDuration} onChange={e => setFormDuration(e.target.value)} />
              </div>
              <div className="field">
                <label>Vitesse (km/h)</label>
                <input type="number" placeholder="8" value={formVitesse} onChange={e => setFormVitesse(e.target.value)} />
              </div>
              <div className="field">
                <label>Inclinaison (%)</label>
                <input type="number" placeholder="0" value={formInclinaison} onChange={e => setFormInclinaison(e.target.value)} />
              </div>
              <div style={{ padding: '12px 0', fontSize: 14, fontWeight: 600, color: 'var(--neon)' }}>
                Estimation : {previewCalories() > 0 ? `${previewCalories()} kcal` : '—'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleSave}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
