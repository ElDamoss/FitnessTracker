import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { TiltCard } from '../components/TiltCard'

interface Mensuration {
  id: string
  user_id: string
  date: string
  poids: number | null
  taille: number | null
  tour_poitrine: number | null
  tour_bras_g: number | null
  tour_bras_d: number | null
  tour_cuisse_g: number | null
  tour_cuisse_d: number | null
  tour_mollet_g: number | null
  tour_mollet_d: number | null
  tour_taille: number | null
  tour_hanche: number | null
  created_at: string
}

const FIELDS = [
  { key: 'poids', label: 'Poids', unit: 'kg' },
  { key: 'taille', label: 'Taille', unit: 'cm' },
  { key: 'tour_poitrine', label: 'Tour de poitrine', unit: 'cm' },
  { key: 'tour_bras_g', label: 'Tour bras gauche', unit: 'cm' },
  { key: 'tour_bras_d', label: 'Tour bras droit', unit: 'cm' },
  { key: 'tour_cuisse_g', label: 'Tour cuisse gauche', unit: 'cm' },
  { key: 'tour_cuisse_d', label: 'Tour cuisse droite', unit: 'cm' },
  { key: 'tour_mollet_g', label: 'Tour mollet gauche', unit: 'cm' },
  { key: 'tour_mollet_d', label: 'Tour mollet droit', unit: 'cm' },
  { key: 'tour_taille', label: 'Tour de taille', unit: 'cm' },
  { key: 'tour_hanche', label: 'Tour de hanche', unit: 'cm' },
] as const

type FieldKey = typeof FIELDS[number]['key']

export default function PageMensurations() {
  const [entries, setEntries] = useState<Mensuration[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('mensurations')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const hasValue = Object.values(values).some(v => v !== '' && v !== null)
    if (!hasValue) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const payload = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v !== '' && v !== null).map(([k, v]) => [k, parseFloat(v)])
    )

    await supabase.from('mensurations').insert({ user_id: user.id, date: today, ...payload })
    setValues({})
    setShowForm(false)
    setSaving(false)
    fetchEntries()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('mensurations').delete().eq('id', id)
    fetchEntries()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getDelta = (current: Mensuration, previous: Mensuration | null, key: FieldKey): string | null => {
    if (!previous) return null
    const cur = current[key] as number | null
    const prev = previous[key] as number | null
    if (cur == null || prev == null) return null
    const diff = cur - prev
    if (diff === 0) return null
    return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
  }

  const getDeltaClass = (delta: string | null): string => {
    if (!delta) return ''
    return delta.startsWith('+') ? 'up' : 'down'
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-h1 display">Mensurations</h2>
        <button className="btn-ghost btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : '+ Saisir'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <TiltCard style={{ padding: 20, marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>
                    {f.label}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder={f.unit}
                      value={values[f.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 32px 8px 10px',
                        fontSize: 13,
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        color: 'var(--ink)',
                      }}
                    />
                    <span style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: 'var(--ink-faint)',
                    }}>
                      {f.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !Object.values(values).some(v => v !== '' && v !== null)}
              style={{ width: '100%' }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les mesures'}
            </button>
          </form>
        </TiltCard>
      )}

      {/* History table */}
      {loading && <div className="empty-state">Chargement…</div>}

      {!loading && entries.length === 0 && (
        <TiltCard style={{ padding: 24 }}>
          <div className="empty-state">Aucune mensuration enregistrée. Clique "Saisir" pour commencer.</div>
        </TiltCard>
      )}

      {!loading && entries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                {FIELDS.map(f => (
                  <th key={f.key} style={thStyle}>{f.label}</th>
                ))}
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const prev = entries[idx + 1] || null
                return (
                  <tr key={entry.id}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{formatDate(entry.date)}</span>
                    </td>
                    {FIELDS.map(f => {
                      const val = entry[f.key] as number | null
                      const delta = getDelta(entry, prev, f.key)
                      const cls = getDeltaClass(delta)
                      return (
                        <td key={f.key} style={tdStyle}>
                          {val != null ? (
                            <span>
                              {val}
                              {delta && (
                                <span style={{
                                  fontSize: 10,
                                  marginLeft: 4,
                                  color: cls === 'up' ? '#3fa66b' : cls === 'down' ? '#e05252' : 'var(--ink-faint)',
                                  fontWeight: 600,
                                }}>
                                  {cls === 'up' ? '↑' : '↓'} {delta}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-faint)' }}>—</span>
                          )}
                        </td>
                      )
                    })}
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="btn-icon"
                        title="Supprimer"
                        style={{ width: 26, height: 26, borderRadius: 7 }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                          <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--ink-faint)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 6px',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}
